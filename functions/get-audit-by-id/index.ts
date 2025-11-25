import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Audit, ApiResponse } from '../../shared/types';
import { MOCK_AUDITS_BASE } from '../../shared/mock-data';
import { calculateStatus, roundToDecimals, getCorsHeaders } from '../../shared/utils';

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

    // Buscar en datos base predefinidos
    const baseAudit = MOCK_AUDITS_BASE.find((a) => a.id === auditId);

    if (!baseAudit) {
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

    // Generar datos mock con variación aleatoria
    const successRate = Math.max(
      0,
      Math.min(1, baseAudit.baseSuccessRate + (Math.random() - 0.5) * 0.04)
    );
    const executions = baseAudit.baseExecutions + Math.floor(Math.random() * 10);
    const failures = baseAudit.baseFailures + Math.floor(Math.random() * 3);

    const audit: Audit = {
      id: baseAudit.id,
      name: baseAudit.name,
      status: calculateStatus(successRate),
      successRate: roundToDecimals(successRate),
      executions,
      failures,
      lastUpdate: new Date().toISOString(),
    };

    const response: ApiResponse<{ audit: Audit }> = {
      success: true,
      data: {
        audit,
      },
      timestamp: new Date().toISOString(),
    };

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

