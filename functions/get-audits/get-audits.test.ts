import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './index';

describe('GetAuditsFunction', () => {
  const createMockEvent = (): APIGatewayProxyEvent => ({
    httpMethod: 'GET',
    path: '/audits',
    pathParameters: null,
    queryStringParameters: null,
    headers: {
      Authorization: 'Bearer test-id-token',
    },
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

  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  it('should return filtered audits mapped from upstream service', async () => {
    const mockUpstreamResponse = [
      { id: '1', name: 'B audit', isInTracking: true },
      { id: '2', name: 'A audit', isInTracking: false },
      { id: '3', name: 'C audit', isInTracking: true },
    ];

    (global as any).fetch.mockResolvedValue({
      ok: true,
      json: async () => mockUpstreamResponse,
    });

    const event = createMockEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.audits)).toBe(true);

    const audits = body.data.audits;
    // Solo los elementos con isInTracking === true
    expect(audits.length).toBe(2);

    const [first, second] = audits;

    // Deben venir ordenados alfabéticamente por name
    expect(first.name).toBe('B audit');
    expect(second.name).toBe('C audit');

    // Estructura y valores por defecto
    for (const audit of audits) {
      expect(audit).toHaveProperty('id');
      expect(audit).toHaveProperty('name');
      expect(audit).toHaveProperty('status', 'ok');
      expect(audit).toHaveProperty('successRate', 1);
      expect(audit).toHaveProperty('executions', 0);
      expect(audit).toHaveProperty('failures', 0);
      expect(audit).toHaveProperty('lastUpdate');
    }
  });

  it('should return 401 when Authorization header is missing', async () => {
    const event: APIGatewayProxyEvent = {
      ...createMockEvent(),
      headers: {},
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(401);

    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 502 when upstream service fails', async () => {
    (global as any).fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal error',
    });

    const event = createMockEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(502);

    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UPSTREAM_ERROR');
  });
});

