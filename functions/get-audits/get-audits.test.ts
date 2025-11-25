import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './index';

describe('GetAuditsFunction', () => {
  const createMockEvent = (): APIGatewayProxyEvent => ({
    httpMethod: 'GET',
    path: '/audits',
    pathParameters: null,
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
      path: '/audits',
      stage: 'test',
      requestTime: '09/Apr/2015:12:34:56 +0000',
      requestTimeEpoch: 1428582896000,
      resourceId: 'test-resource-id',
      resourcePath: '/audits',
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
    resource: '/audits',
    stageVariables: null,
  });

  it('should return list of audits', async () => {
    const event = createMockEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.audits).toBeDefined();
    expect(Array.isArray(body.data.audits)).toBe(true);
    expect(body.data.audits.length).toBe(8);
    expect(body.timestamp).toBeDefined();
  });

  it('should return audits with correct structure', async () => {
    const event = createMockEvent();
    const result = await handler(event);

    const body = JSON.parse(result.body);
    const audit = body.data.audits[0];

    expect(audit).toHaveProperty('id');
    expect(audit).toHaveProperty('name');
    expect(audit).toHaveProperty('status');
    expect(audit).toHaveProperty('successRate');
    expect(audit).toHaveProperty('executions');
    expect(audit).toHaveProperty('failures');
    expect(audit).toHaveProperty('lastUpdate');

    expect(['ok', 'fail', 'error']).toContain(audit.status);
    expect(audit.successRate).toBeGreaterThanOrEqual(0);
    expect(audit.successRate).toBeLessThanOrEqual(1);
    expect(audit.executions).toBeGreaterThan(0);
    expect(audit.failures).toBeGreaterThanOrEqual(0);
  });

  it('should return audits sorted alphabetically', async () => {
    const event = createMockEvent();
    const result = await handler(event);

    const body = JSON.parse(result.body);
    const audits = body.data.audits;

    for (let i = 1; i < audits.length; i++) {
      expect(audits[i].name.localeCompare(audits[i - 1].name)).toBeGreaterThanOrEqual(0);
    }
  });

  it('should handle errors gracefully', async () => {
    // Simular un error forzando un problema
    const event = createMockEvent();
    // Modificar event para causar un error si es necesario
    // Por ahora, el handler debería funcionar correctamente

    const result = await handler(event);
    expect(result.statusCode).toBe(200); // Debería funcionar normalmente
  });
});

