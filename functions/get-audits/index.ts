import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Audit, ApiResponse, WebRouteAudit } from '../../shared/types';
import {
  enrichAuditsWithMetrics,
  getCorsHeaders,
  getRouteServiceUrl,
} from '../../shared/utils';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('GetAudits handler invoked', {
      requestId: event.requestContext.requestId,
      user: event.requestContext.authorizer?.claims?.sub,
    });

    const authHeader =
      event.headers.Authorization || event.headers.authorization || '';

    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      console.error('Missing or invalid Authorization header');
      const errorResponse: ApiResponse<never> = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization header with Bearer token is required',
        },
      };

      return {
        statusCode: 401,
        headers: getCorsHeaders(),
        body: JSON.stringify(errorResponse),
      };
    }

    const idToken = authHeader.slice('bearer '.length).trim();

    // Decodificar el JWT directamente para obtener todos los claims
    // API Gateway puede no pasar todos los claims, así que los extraemos del token
    let claims: Record<string, any> = {};
    
    try {
      // Decodificar el payload del JWT (sin verificar la firma, solo para extraer claims)
      const parts = idToken.split('.');
      if (parts.length === 3) {
        // Decodificar el payload (segunda parte del JWT)
        const payload = parts[1];
        // Añadir padding si es necesario para base64url
        const paddedPayload = payload + '='.repeat((4 - (payload.length % 4)) % 4);
        const decodedPayload = Buffer.from(paddedPayload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
        claims = JSON.parse(decodedPayload);
      }
    } catch (error) {
      console.error('Error decoding JWT token', error);
    }

    // Si no pudimos decodificar, usar los claims de API Gateway como fallback
    if (!claims.sub) {
      claims = event.requestContext.authorizer?.claims || {};
    }

    if (!claims.sub) {
      console.error('Unable to extract user claims from token or request context', {
        authorizer: event.requestContext.authorizer,
      });
      const errorResponse: ApiResponse<never> = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Unable to identify user',
        },
      };

      return {
        statusCode: 401,
        headers: getCorsHeaders(),
        body: JSON.stringify(errorResponse),
      };
    }

    // Log todos los claims disponibles para debugging
    console.log('All available claims from decoded token', {
      allClaims: JSON.stringify(claims, null, 2),
    });

    // Construir el objeto JSON con los claims del usuario (formato esperado por la API web)
    // Incluimos todos los claims relevantes del token de Cognito
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
      // Incluir otros claims custom si existen
      ...(claims['custom:appmobil'] && { 'custom:appmobil': claims['custom:appmobil'] }),
      ...(claims['custom:theme'] && { 'custom:theme': claims['custom:theme'] }),
      ...(claims['custom:language'] && { 'custom:language': claims['custom:language'] }),
      ...(claims['custom:timezone'] && { 'custom:timezone': claims['custom:timezone'] }),
    };

    // Convertir el objeto a string JSON para la cabecera
    const xAuthUserHeader = JSON.stringify(authUserObject);

    console.log('Sending X-Auth-User header', {
      xAuthUserHeader,
      sub: claims.sub,
    });

    const routeServiceUrl = getRouteServiceUrl();
    const upstreamResponse = await fetch(routeServiceUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'X-Auth-User': xAuthUserHeader,
      },
    });

    if (!upstreamResponse.ok) {
      const text = await upstreamResponse.text().catch(() => '');
      console.error('Failed calling route-service/route', {
        status: upstreamResponse.status,
        body: text,
      });

      const errorResponse: ApiResponse<never> = {
        success: false,
        error: {
          code: 'UPSTREAM_ERROR',
          message: 'Failed to retrieve audits from upstream service',
        },
      };

      return {
        statusCode: 502,
        headers: getCorsHeaders(),
        body: JSON.stringify(errorResponse),
      };
    }

    const webAudits = (await upstreamResponse.json()) as WebRouteAudit[];
    
    console.log('Received audits from route-service/route', {
      totalAudits: webAudits.length,
      auditsWithTracking: webAudits.filter((a) => a.isInTracking === true).length,
      sampleAudit: webAudits[0] || null,
    });

    // Filtrar únicamente las auditorías en tracking
    const filteredWebAudits = webAudits.filter(
      (audit) => audit.isInTracking === true
    );

    // Mapear auditorías de la API web a nuestro formato
    // Incluimos lastExecution de la API web para lastUpdate
    // Nota: La API web devuelve _id, no id
    const baseAudits: Audit[] = filteredWebAudits.map((audit) => ({
      id: (audit as any)._id || audit.id,
      name: audit.name,
      // Valores por defecto que se enriquecerán con datos reales desde OpenSearch
      status: 'ok',
      successRate: 1,
      executions: 0,
      failures: 0,
      // lastExecution viene de la API web, si no está disponible usar fecha actual
      lastUpdate:
        (audit as any).lastExecution ||
        (audit as any).lastUpdate ||
        new Date().toISOString(),
    }));

    console.log('Base audits before enrichment', {
      count: baseAudits.length,
      audits: baseAudits.map((a) => ({ id: a.id, name: a.name })),
    });

    // Enriquecer con métricas reales desde OpenSearch
    const audits = await enrichAuditsWithMetrics(baseAudits);

    console.log('Audits after enrichment', {
      count: audits.length,
      sample: audits[0] || null,
    });

    // Ordenar alfabéticamente
    audits.sort((a, b) => a.name.localeCompare(b.name));

    const response: ApiResponse<{ audits: Audit[] }> = {
      success: true,
      data: {
        audits,
      },
      timestamp: new Date().toISOString(),
    };

    console.log('Final response being sent', {
      auditCount: audits.length,
      auditIds: audits.map((a) => a.id),
      sampleAudit: audits[0] || null,
      responseBody: JSON.stringify(response).substring(0, 500), // Primeros 500 caracteres
    });

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error getting audits:', error);
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

