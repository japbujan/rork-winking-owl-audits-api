import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './index';

describe('GetAuditByIdFunction', () => {
  const createMockEvent = (auditId: string): APIGatewayProxyEvent => ({
    httpMethod: 'GET',
    path: `/audits/${auditId}`,
    pathParameters: { auditId },
    queryStringParameters: null,
    headers: {},
    multiValueHeaders: {},
    body: null,
    isBase64Encoded: false,
    requestContext: {
      requestId: 'test-request-id',
      accountId: '123456789012',
      apiId: 'test-api-id',
      authorizer: {
        claims: {
          sub: 'test-user-id',
        },
      },
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      path: `/audits/${auditId}`,
      stage: 'test',
      requestTime: '09/Apr/2015:12:34:56 +0000',
      requestTimeEpoch: 1428582896000,
      resourceId: 'test-resource-id',
      resourcePath: '/audits/{auditId}',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
      },
    },
    resource: '/audits/{auditId}',
    stageVariables: null,
  });

  it('should return audit by id', async () => {
    const event = createMockEvent('a1');
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data.audit).toBeDefined();
    expect(body.data.audit.id).toBe('a1');
  });

  it('should return 404 for non-existent audit', async () => {
    const event = createMockEvent('non-existent');
    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('AUDIT_NOT_FOUND');
  });

  it('should return 400 for missing auditId', async () => {
    const event = createMockEvent('');
    event.pathParameters = null;
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return audit with correct structure', async () => {
    const event = createMockEvent('a1');
    const result = await handler(event);

    const body = JSON.parse(result.body);
    const audit = body.data.audit;

    expect(audit).toHaveProperty('id');
    expect(audit).toHaveProperty('name');
    expect(audit).toHaveProperty('status');
    expect(audit).toHaveProperty('successRate');
    expect(audit).toHaveProperty('executions');
    expect(audit).toHaveProperty('failures');
    expect(audit).toHaveProperty('lastUpdate');
  });
});

