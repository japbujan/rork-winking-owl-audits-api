import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Audit, ApiResponse } from '../../shared/types';
import { MOCK_AUDITS_BASE } from '../../shared/mock-data';
import { calculateStatus, roundToDecimals, getCorsHeaders } from '../../shared/utils';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('GetAudits handler invoked', {
      requestId: event.requestContext.requestId,
      user: event.requestContext.authorizer?.claims?.sub,
    });

    // Generar auditorías con variación aleatoria
    const audits: Audit[] = MOCK_AUDITS_BASE.map((base) => {
      // Variación aleatoria en successRate (±0.02)
      const successRate = Math.max(
        0,
        Math.min(1, base.baseSuccessRate + (Math.random() - 0.5) * 0.04)
      );

      // Variación aleatoria en executions y failures
      const executions = base.baseExecutions + Math.floor(Math.random() * 10);
      const failures = base.baseFailures + Math.floor(Math.random() * 3);

      return {
        id: base.id,
        name: base.name,
        status: calculateStatus(successRate),
        successRate: roundToDecimals(successRate),
        executions,
        failures,
        lastUpdate: new Date().toISOString(),
      };
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

