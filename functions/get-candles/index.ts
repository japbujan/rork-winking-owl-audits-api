import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PeriodData, TimeRange, ApiResponse } from '../../shared/types';
import {
  getCorsHeaders,
  getRouteNameFromApi,
  queryOpenSearchPeriods,
} from '../../shared/utils';

const RANGE_CONFIG: Record<TimeRange, { count: number; intervalMs: number }> = {
  '1H': { count: 12, intervalMs: 5 * 60 * 1000 },
  '1D': { count: 24, intervalMs: 60 * 60 * 1000 },
  '1W': { count: 42, intervalMs: 4 * 60 * 60 * 1000 },
  '1M': { count: 30, intervalMs: 24 * 60 * 60 * 1000 },
  '3M': { count: 90, intervalMs: 24 * 60 * 60 * 1000 },
  '1Y': { count: 52, intervalMs: 7 * 24 * 60 * 60 * 1000 },
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('GetCandles raw event data', {
      pathParameters: event.pathParameters,
      queryStringParameters: event.queryStringParameters,
      path: event.path,
      resource: event.resource,
    });

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

    // Decodificar claims del token
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

    // Obtener routeName consultando la API web
    const routeName = await getRouteNameFromApi(auditId, idToken, claims);

    if (!routeName) {
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

    // Calcular fechas según el rango
    const { count, intervalMs } = RANGE_CONFIG[range];
    const now = new Date();
    const totalDurationMs = count * intervalMs;
    const startDate = new Date(now.getTime() - totalDurationMs);

    // Consultar OpenSearch con date_histogram
    const periods = await queryOpenSearchPeriods(
      routeName,
      startDate,
      now,
      intervalMs
    );

    // Si OpenSearch falla, devolver períodos vacíos
    const finalPeriods: PeriodData[] = periods || [];

    const response: ApiResponse<{
      auditId: string;
      range: TimeRange;
      periods: PeriodData[];
    }> = {
      success: true,
      data: {
        auditId,
        range,
        periods: finalPeriods,
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

