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
    const auditId = event.pathParameters?.auditId;

    console.log('GetAuditById handler invoked', {
      requestId: event.requestContext.requestId,
      auditId,
      user: event.requestContext.authorizer?.claims?.sub,
    });

    // Validar auditId
    if (!auditId) {
      const errorResponse: ApiResponse<never> = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'auditId is required',
        },
      };

      return {
        statusCode: 400,
        headers: getCorsHeaders(),
        body: JSON.stringify(errorResponse),
      };
    }

    // Obtener token de autorización
    const authHeader =
      event.headers.Authorization || event.headers.authorization || '';

    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
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
    let claims: Record<string, any> = {};
    try {
      const parts = idToken.split('.');
      if (parts.length === 3) {
        const payload = parts[1];
        const paddedPayload = payload + '='.repeat((4 - (payload.length % 4)) % 4);
        const decodedPayload = Buffer.from(
          paddedPayload.replace(/-/g, '+').replace(/_/g, '/'),
          'base64'
        ).toString('utf-8');
        claims = JSON.parse(decodedPayload);
      }
    } catch (error) {
      console.error('Error decoding JWT token', error);
    }

    if (!claims.sub) {
      claims = event.requestContext.authorizer?.claims || {};
    }

    // Construir el objeto JSON con los claims del usuario
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

    // Consultar la API web para obtener todas las auditorías
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
          message: 'Failed to retrieve audit from upstream service',
        },
      };

      return {
        statusCode: 502,
        headers: getCorsHeaders(),
        body: JSON.stringify(errorResponse),
      };
    }

    const webAudits = (await upstreamResponse.json()) as WebRouteAudit[];

    // Buscar la auditoría por ID (puede ser _id o id)
    const webAudit = webAudits.find(
      (a) => (a as any)._id === auditId || a.id === auditId
    );

    if (!webAudit) {
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

    // Mapear a nuestro formato
    const baseAudit: Audit = {
      id: (webAudit as any)._id || webAudit.id,
      name: webAudit.name,
      status: 'ok',
      successRate: 1,
      executions: 0,
      failures: 0,
      lastUpdate:
        (webAudit as any).lastExecution ||
        (webAudit as any).lastUpdate ||
        new Date().toISOString(),
    };

    // Enriquecer con métricas reales desde OpenSearch
    const [enrichedAudit] = await enrichAuditsWithMetrics([baseAudit]);

    const response: ApiResponse<{ audit: Audit }> = {
      success: true,
      data: {
        audit: enrichedAudit,
      },
      timestamp: new Date().toISOString(),
    };

    console.log('GetAuditById response', {
      auditId: enrichedAudit.id,
      auditName: enrichedAudit.name,
    });

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error getting audit by id:', error);
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

