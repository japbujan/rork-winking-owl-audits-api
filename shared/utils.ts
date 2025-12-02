import { Audit, AuditStatus, PeriodData } from './types';

// Base URL de la API web de Winking Owl utilizada por la app web
// Documentación: https://api.winking-owl.com/docs/
export const WINKING_OWL_API_BASE_URL = 'https://api.winking-owl.com';

export function getRouteServiceUrl(): string {
  return `${WINKING_OWL_API_BASE_URL}/route-service/route`;
}

// Base URL de OpenSearch para consultar datos de ejecuciones
export const OPENSEARCH_BASE_URL = 'https://datawarehouse.winking-owl.com';
export const OPENSEARCH_INDEX = 'winking-owl-data-index';

export function calculateStatus(successRate: number): AuditStatus {
  if (successRate >= 0.95) return 'ok';
  if (successRate >= 0.80) return 'fail';
  return 'error';
}

export function roundToDecimals(value: number, decimals: number = 3): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function getCorsHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
  };
}

/**
 * Convierte intervalMs a formato de intervalo de OpenSearch
 * Ejemplos: 300000 (5min) -> "5m", 3600000 (1h) -> "1h", 86400000 (1d) -> "1d"
 */
function intervalMsToOpenSearchInterval(intervalMs: number): string {
  const seconds = intervalMs / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;
  const weeks = days / 7;

  if (weeks >= 1 && weeks % 1 === 0) {
    return `${weeks}w`;
  }
  if (days >= 1 && days % 1 === 0) {
    return `${days}d`;
  }
  if (hours >= 1 && hours % 1 === 0) {
    return `${hours}h`;
  }
  if (minutes >= 1 && minutes % 1 === 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * Construye una query de agregación para OpenSearch
 * @param auditName Nombre de la auditoría (routeName)
 * @param startDate Fecha de inicio (ISO string o Date)
 * @param endDate Fecha de fin (ISO string o Date)
 * @param intervalMs Opcional: intervalo para date_histogram (en milisegundos)
 * @returns Query JSON para OpenSearch
 */
export function buildOpenSearchAggregationQuery(
  auditName: string,
  startDate: string | Date,
  endDate: string | Date,
  intervalMs?: number
): object {
  const startDateStr = typeof startDate === 'string' ? startDate : startDate.toISOString();
  const endDateStr = typeof endDate === 'string' ? endDate : endDate.toISOString();

  const query: any = {
    query: {
      bool: {
        must: [
          { term: { 'routeName.keyword': auditName } },
          {
            range: {
              routeStopDate: {
                gte: startDateStr,
                lt: endDateStr,
              },
            },
          },
        ],
      },
    },
    size: 0, // Solo queremos agregaciones, no documentos
  };

  // Agregación base: términos únicos por routeExecutionID
  const uniqueExecutionsAgg = {
    terms: {
      field: 'routeExecutionID.keyword',
      size: 10000, // Máximo de ejecuciones únicas
    },
    aggs: {
      failed_count: {
        filter: {
          term: { 'routeResult.keyword': 'failed' },
        },
      },
    },
  };

  // Si hay intervalMs, usar date_histogram
  if (intervalMs) {
    const interval = intervalMsToOpenSearchInterval(intervalMs);
    query.aggs = {
      periods: {
        date_histogram: {
          field: 'routeStopDate',
          fixed_interval: interval,
          min_doc_count: 0, // Incluir períodos sin documentos
          extended_bounds: {
            min: startDateStr,
            max: endDateStr,
          },
        },
        aggs: {
          unique_executions: uniqueExecutionsAgg,
        },
      },
    };
  } else {
    // Sin date_histogram, agregación directa
    query.aggs = {
      unique_executions: uniqueExecutionsAgg,
    };
  }

  return query;
}

/**
 * Obtiene el routeName (name) de una auditoría consultando la API web
 * @param auditId ID de la auditoría
 * @param idToken Token de Cognito para autenticación
 * @param claims Claims del usuario para X-Auth-User header
 * @returns routeName o null si hay error
 */
export async function getRouteNameFromApi(
  auditId: string,
  idToken: string,
  claims: Record<string, any>
): Promise<string | null> {
  try {
    const authUserObject = {
      sub: claims.sub,
      email_verified: claims.email_verified || false,
      profile: claims.profile || claims['custom:profile'] || '',
      'custom:group': claims['custom:group'] || '',
      given_name: claims.given_name || '',
      name: claims.name || claims['cognito:username'] || '',
      'custom:client': claims['custom:client'] || '',
      family_name: claims.family_name || '',
      email: claims.email || '',
      ...(claims['custom:appmobil'] && { 'custom:appmobil': claims['custom:appmobil'] }),
      ...(claims['custom:theme'] && { 'custom:theme': claims['custom:theme'] }),
      ...(claims['custom:language'] && { 'custom:language': claims['custom:language'] }),
      ...(claims['custom:timezone'] && { 'custom:timezone': claims['custom:timezone'] }),
    };

    const xAuthUserHeader = JSON.stringify(authUserObject);

    const routeServiceUrl = getRouteServiceUrl();
    const response = await fetch(routeServiceUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'X-Auth-User': xAuthUserHeader,
      },
    });

    if (!response.ok) {
      console.error('Failed to get route name from API', {
        status: response.status,
        auditId,
      });
      return null;
    }

    const audits = (await response.json()) as any[];
    const audit = audits.find((a) => a._id === auditId || a.id === auditId);
    return audit?.name || null;
  } catch (error) {
    console.error('Error getting route name from API', { auditId, error });
    return null;
  }
}

/**
 * Consulta OpenSearch para obtener métricas de una auditoría
 * @param auditName Nombre de la auditoría (routeName)
 * @param hoursBack Número de horas hacia atrás para el filtro (default: 24)
 * @returns Objeto con executions y failures, o null si hay error
 */
async function queryOpenSearchMetrics(
  auditName: string,
  hoursBack: number = 24
): Promise<{ executions: number; failures: number } | null> {
  try {
    console.log('queryOpenSearchMetrics called', { auditName, hoursBack });
    const now = new Date();
    const startDate = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

    const query = buildOpenSearchAggregationQuery(auditName, startDate, now);
    console.log('OpenSearch query for metrics', {
      auditName,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos timeout

    const response = await fetch(
      `${OPENSEARCH_BASE_URL}/${OPENSEARCH_INDEX}/_search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('OpenSearch query failed', {
        status: response.status,
        body: text,
        auditName,
      });
      return null;
    }

    const data = await response.json();

    // Extraer agregaciones
    const uniqueExecutions = data.aggregations?.unique_executions?.buckets || [];
    const executions = uniqueExecutions.length;

    // Contar failures: sumar los buckets que tienen failed_count > 0
    let failures = 0;
    for (const bucket of uniqueExecutions) {
      const failedCount = bucket.failed_count?.doc_count || 0;
      if (failedCount > 0) {
        failures++;
      }
    }

    console.log('OpenSearch metrics result', {
      auditName,
      executions,
      failures,
      uniqueExecutionsCount: uniqueExecutions.length,
    });

    return { executions, failures };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('OpenSearch query timeout', { auditName });
    } else {
      console.error('Error querying OpenSearch', { auditName, error });
    }
    return null;
  }
}

/**
 * Consulta OpenSearch para obtener períodos de datos con date_histogram
 * @param auditName Nombre de la auditoría (routeName)
 * @param startDate Fecha de inicio
 * @param endDate Fecha de fin
 * @param intervalMs Intervalo para date_histogram en milisegundos
 * @returns Array de PeriodData o null si hay error
 */
export async function queryOpenSearchPeriods(
  auditName: string,
  startDate: Date,
  endDate: Date,
  intervalMs: number
): Promise<PeriodData[] | null> {
  try {
    const query = buildOpenSearchAggregationQuery(
      auditName,
      startDate,
      endDate,
      intervalMs
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${OPENSEARCH_BASE_URL}/${OPENSEARCH_INDEX}/_search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('OpenSearch periods query failed', {
        status: response.status,
        body: text,
        auditName,
      });
      return null;
    }

    const data = await response.json();
    const periods: PeriodData[] = [];

    // Extraer buckets del date_histogram
    const periodBuckets = data.aggregations?.periods?.buckets || [];

    for (const bucket of periodBuckets) {
      const uniqueExecutions = bucket.unique_executions?.buckets || [];
      const samples = uniqueExecutions.length;

      // Contar failures: ejecuciones que tienen failed_count > 0
      let failures = 0;
      for (const execBucket of uniqueExecutions) {
        const failedCount = execBucket.failed_count?.doc_count || 0;
        if (failedCount > 0) {
          failures++;
        }
      }

      periods.push({
        timestamp: bucket.key_as_string || new Date(bucket.key).toISOString(),
        samples,
        failures,
      });
    }

    return periods;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('OpenSearch periods query timeout', { auditName });
    } else {
      console.error('Error querying OpenSearch periods', { auditName, error });
    }
    return null;
  }
}

/**
 * Enriquecimiento de auditorías con métricas reales obtenidas desde OpenSearch
 * Consulta OpenSearch para cada auditoría y calcula indicadores basados en
 * ejecuciones únicas de las últimas 24 horas.
 */
export async function enrichAuditsWithMetrics(
  audits: Audit[]
): Promise<Audit[]> {
  console.log('enrichAuditsWithMetrics called', {
    auditCount: audits.length,
    auditNames: audits.map((a) => a.name),
  });

  if (audits.length === 0) {
    return audits;
  }

  // Ejecutar todas las consultas en paralelo
  const metricsPromises = audits.map((audit) =>
    queryOpenSearchMetrics(audit.name, 24).then((metrics) => ({
      audit,
      metrics,
    }))
  );

  const results = await Promise.all(metricsPromises);

  console.log('OpenSearch metrics results', {
    results: results.map(({ audit, metrics }) => ({
      auditName: audit.name,
      hasMetrics: !!metrics,
      executions: metrics?.executions || 0,
      failures: metrics?.failures || 0,
    })),
  });

  // Enriquecer cada auditoría con las métricas obtenidas
  return results.map(({ audit, metrics }) => {
    if (!metrics) {
      // Si falló la consulta, usar valores por defecto
      console.log('Using default metrics for audit', { auditName: audit.name });
      return {
        ...audit,
        executions: 0,
        failures: 0,
        successRate: 1,
        status: 'ok' as AuditStatus,
      };
    }

    const { executions, failures } = metrics;
    const successRate =
      executions > 0 ? (executions - failures) / executions : 1.0;

    return {
      ...audit,
      executions,
      failures,
      successRate: roundToDecimals(successRate),
      status: calculateStatus(successRate),
      // lastUpdate ya viene de la API web (lastExecution), no se modifica
    };
  });
}

