import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PeriodData, TimeRange, ApiResponse } from '../../shared/types';
import { BASE_SUCCESS_RATES } from '../../shared/mock-data';
import { getCorsHeaders } from '../../shared/utils';

const RANGE_CONFIG: Record<TimeRange, { count: number; intervalMs: number }> = {
  '1H': { count: 12, intervalMs: 5 * 60 * 1000 },
  '1D': { count: 24, intervalMs: 60 * 60 * 1000 },
  '1W': { count: 42, intervalMs: 4 * 60 * 60 * 1000 },
  '1M': { count: 30, intervalMs: 24 * 60 * 60 * 1000 },
  '3M': { count: 90, intervalMs: 24 * 60 * 60 * 1000 },
  '1Y': { count: 52, intervalMs: 7 * 24 * 60 * 60 * 1000 },
};

// Función para obtener una tendencia determinística pero variada basada en el auditId
function getTrendDirection(auditId: string): 'up' | 'down' | 'neutral' {
  // Usar el último carácter del ID para determinar tendencia de forma determinística
  const lastChar = auditId[auditId.length - 1];
  let num = parseInt(lastChar, 10);
  
  if (isNaN(num)) {
    // Si no es un número, usar hash simple del string
    let hash = 0;
    for (let i = 0; i < auditId.length; i++) {
      hash = auditId.charCodeAt(i) + ((hash << 5) - hash);
    }
    num = Math.abs(hash) % 10;
  }
  
  // Distribución: 40% arriba, 40% abajo, 20% neutro
  if (num < 4) return 'up';
  if (num < 8) return 'down';
  return 'neutral';
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const auditId = event.pathParameters?.auditId;
    const range = event.queryStringParameters?.range as TimeRange;

    console.log('GetCandles handler invoked', {
      requestId: event.requestContext.requestId,
      auditId,
      range,
      user: event.requestContext.authorizer?.claims?.sub,
    });

    // Validaciones
    if (!auditId || !range) {
      const errorResponse: ApiResponse<never> = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'auditId and range are required',
        },
      };

      return {
        statusCode: 400,
        headers: getCorsHeaders(),
        body: JSON.stringify(errorResponse),
      };
    }

    if (!Object.keys(RANGE_CONFIG).includes(range)) {
      const errorResponse: ApiResponse<never> = {
        success: false,
        error: {
          code: 'INVALID_RANGE',
          message: 'Range must be one of: 1H, 1D, 1W, 1M, 3M, 1Y',
        },
      };

      return {
        statusCode: 400,
        headers: getCorsHeaders(),
        body: JSON.stringify(errorResponse),
      };
    }

    const baseSuccessRate = BASE_SUCCESS_RATES[auditId];
    if (!baseSuccessRate) {
      const errorResponse: ApiResponse<never> = {
        success: false,
        error: {
          code: 'AUDIT_NOT_FOUND',
          message: `Audit with id '${auditId}' not found`,
        },
      };

      return {
        statusCode: 404,
        headers: getCorsHeaders(),
        body: JSON.stringify(errorResponse),
      };
    }

    /**
     * Calcula un multiplicador de error basado en patrones típicos
     */
    function getErrorPatternMultiplier(date: Date, auditId: string): number {
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      
      let multiplier = 1.0;
      
      if (hour >= 9 && hour <= 11) {
        multiplier = 1.5 + Math.random() * 0.5;
      } else if (hour >= 14 && hour <= 16) {
        multiplier = 1.3 + Math.random() * 0.4;
      } else if (hour >= 22 || hour <= 6) {
        multiplier = 0.3 + Math.random() * 0.3;
      } else {
        multiplier = 0.8 + Math.random() * 0.4;
      }
      
      if (dayOfWeek === 1) {
        multiplier *= 1.4;
      } else if (dayOfWeek === 5 && hour >= 15 && hour <= 17) {
        multiplier *= 1.6;
      } else if (dayOfWeek === 0 || dayOfWeek === 6) {
        multiplier *= 0.5;
      }
      
      const auditHash = auditId.charCodeAt(0) % 10;
      const hourOffset = (auditHash + hour) % 24;
      
      if (hourOffset >= 10 && hourOffset <= 12) {
        multiplier *= 1.2;
      }
      
      return multiplier;
    }

    // Generar períodos de datos
    const { count, intervalMs } = RANGE_CONFIG[range];
    const now = Date.now();
    const periods: PeriodData[] = [];

    // Determinar dirección de tendencia
    const trendDirection = getTrendDirection(auditId);
    let trendMultiplier: number;
    switch (trendDirection) {
      case 'up':
        trendMultiplier = 0.001; // Mejora gradual
        break;
      case 'down':
        trendMultiplier = -0.001; // Empeora gradualmente
        break;
      case 'neutral':
        trendMultiplier = 0;
        break;
    }

    // Crear períodos con incidentes concentrados
    const incidentPeriods: number[] = [];
    const numIncidents = Math.floor(count * 0.15);
    for (let i = 0; i < numIncidents; i++) {
      incidentPeriods.push(Math.floor(Math.random() * count));
    }

    // Base de muestras por período según el rango
    const baseSamplesPerPeriod: Record<TimeRange, number> = {
      '1H': 50,   // ~50 ejecuciones cada 5 minutos
      '1D': 120,  // ~120 ejecuciones cada hora
      '1W': 200,  // ~200 ejecuciones cada 4 horas
      '1M': 300,  // ~300 ejecuciones por día
      '3M': 500,  // ~500 ejecuciones por día
      '1Y': 1000, // ~1000 ejecuciones por semana
    };
    const baseSamples = baseSamplesPerPeriod[range] || 100;

    for (let i = count - 1; i >= 0; i--) {
      const timestamp = new Date(now - i * intervalMs);
      const date = new Date(timestamp);
      
      const hasIncident = incidentPeriods.includes(i);
      const errorMultiplier = getErrorPatternMultiplier(date, auditId);
      
      // Variación en successRate
      let variance = (Math.random() - 0.5) * 0.015; // ±0.75%
      
      if (hasIncident) {
        variance -= 0.03 + Math.random() * 0.02; // -3% a -5% (más errores)
      }
      
      // Aplicar tendencia
      const trend = (count - i) * trendMultiplier;
      
      // Calcular successRate para este período
      const successRate = Math.max(0, Math.min(1, baseSuccessRate + variance + trend));
      const failureRate = 1 - successRate;

      // Calcular número de muestras (variación según hora del día y patrones)
      // Horas pico tienen más muestras
      const hour = date.getHours();
      let samplesMultiplier = 1.0;
      if (hour >= 9 && hour <= 11) {
        samplesMultiplier = 1.5 + Math.random() * 0.3; // 1.5-1.8x
      } else if (hour >= 14 && hour <= 16) {
        samplesMultiplier = 1.3 + Math.random() * 0.2; // 1.3-1.5x
      } else if (hour >= 22 || hour <= 6) {
        samplesMultiplier = 0.4 + Math.random() * 0.2; // 0.4-0.6x
      } else {
        samplesMultiplier = 0.9 + Math.random() * 0.2; // 0.9-1.1x
      }
      
      const samples = Math.max(1, Math.floor(baseSamples * samplesMultiplier * (0.8 + Math.random() * 0.4)));

      // Calcular failures de forma coherente: failures = samples * failureRate
      // Añadir variación aleatoria pequeña para simular realidad
      const expectedFailures = samples * failureRate;
      const failures = Math.max(0, Math.round(expectedFailures + (Math.random() - 0.5) * 0.1 * samples));
      
      // Asegurar que failures no exceda samples
      const finalFailures = Math.min(failures, samples);

      periods.push({
        timestamp: timestamp.toISOString(),
        samples,
        failures: finalFailures,
      });
    }

    const response: ApiResponse<{
      auditId: string;
      range: TimeRange;
      periods: PeriodData[];
    }> = {
      success: true,
      data: {
        auditId,
        range,
        periods,
      },
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error getting candles:', error);
    const errorResponse: ApiResponse<never> = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
      },
    };

    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify(errorResponse),
    };
  }
};

