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

    // Generar velas
    const { count, intervalMs } = RANGE_CONFIG[range];
    const now = Date.now();
    const candles: Candle[] = [];

    // Determinar dirección de tendencia
    const trendDirection = getTrendDirection(auditId);
    let trendMultiplier: number;
    switch (trendDirection) {
      case 'up':
        trendMultiplier = 0.001;
        break;
      case 'down':
        trendMultiplier = -0.001;
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

    for (let i = count - 1; i >= 0; i--) {
      const timestamp = new Date(now - i * intervalMs);
      const date = new Date(timestamp);
      
      const hasIncident = incidentPeriods.includes(i);
      const errorMultiplier = getErrorPatternMultiplier(date, auditId);
      
      let variance = (Math.random() - 0.5) * 0.015;
      
      if (hasIncident) {
        variance -= 0.03 + Math.random() * 0.02;
      }
      
      const trend = (count - i) * trendMultiplier;

      const open = Math.max(0, Math.min(1, baseSuccessRate + variance));
      const close = Math.max(
        0,
        Math.min(1, baseSuccessRate + variance + trend + (Math.random() - 0.5) * 0.01)
      );
      const high = Math.min(1, Math.max(open, close) + Math.random() * 0.01);
      const low = Math.max(0, Math.min(open, close) - Math.random() * 0.01);

      let failures = 0;
      const failureRate = 1 - close;
      
      if (failureRate > 0.01) {
        const baseFailures = Math.random() < 0.3 ? 1 : 0;
        failures = Math.floor(baseFailures * errorMultiplier);
        
        if (hasIncident) {
          failures = Math.max(failures, Math.floor(2 + Math.random() * 4));
        }
      }

      candles.push({
        timestamp: timestamp.toISOString(),
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

