import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Candle, TimeRange, ApiResponse } from '../../shared/types';
import { BASE_SUCCESS_RATES } from '../../shared/mock-data';
import { roundToDecimals, getCorsHeaders } from '../../shared/utils';

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

    // Generar velas
    const { count, intervalMs } = RANGE_CONFIG[range];
    const now = Date.now();
    const candles: Candle[] = [];

    for (let i = count - 1; i >= 0; i--) {
      const timestamp = new Date(now - i * intervalMs).toISOString();
      const variance = (Math.random() - 0.5) * 0.1;
      const trend = (count - i) * 0.001; // Tendencia positiva hacia el presente

      const open = Math.max(0, Math.min(1, baseSuccessRate + variance));
      const close = Math.max(
        0,
        Math.min(1, baseSuccessRate + variance + trend + (Math.random() - 0.5) * 0.05)
      );
      const high = Math.min(1, Math.max(open, close) + Math.random() * 0.03);
      const low = Math.max(0, Math.min(open, close) - Math.random() * 0.03);
      const failures = Math.floor(Math.random() * 5);

      candles.push({
        timestamp,
        open: roundToDecimals(open),
        high: roundToDecimals(high),
        low: roundToDecimals(low),
        close: roundToDecimals(close),
        failures,
      });
    }

    const response: ApiResponse<{
      auditId: string;
      range: TimeRange;
      candles: Candle[];
    }> = {
      success: true,
      data: {
        auditId,
        range,
        candles,
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

