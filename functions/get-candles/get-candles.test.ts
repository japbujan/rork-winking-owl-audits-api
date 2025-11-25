import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './index';

describe('GetCandlesFunction', () => {
  const createMockEvent = (auditId: string, range: string): APIGatewayProxyEvent => ({
    httpMethod: 'GET',
    path: `/audits/${auditId}/candles`,
    pathParameters: { auditId },
    queryStringParameters: { range },
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
      path: `/audits/${auditId}/candles`,
      stage: 'test',
      requestTime: '09/Apr/2015:12:34:56 +0000',
      requestTimeEpoch: 1428582896000,
      resourceId: 'test-resource-id',
      resourcePath: '/audits/{auditId}/candles',
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
    resource: '/audits/{auditId}/candles',
    stageVariables: null,
  });

  it('should return candles for valid auditId and range', async () => {
    const event = createMockEvent('a1', '1D');
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.candles).toBeDefined();
    expect(Array.isArray(body.data.candles)).toBe(true);
    expect(body.data.candles.length).toBe(24); // 1D = 24 candles
  });

  it('should return correct number of candles for each range', async () => {
    const ranges = [
      { range: '1H', expectedCount: 12 },
      { range: '1D', expectedCount: 24 },
      { range: '1W', expectedCount: 42 },
      { range: '1M', expectedCount: 30 },
      { range: '3M', expectedCount: 90 },
      { range: '1Y', expectedCount: 52 },
    ];

    for (const { range, expectedCount } of ranges) {
      const event = createMockEvent('a1', range);
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.candles.length).toBe(expectedCount);
    }
  });

  it('should return 400 for invalid range', async () => {
    const event = createMockEvent('a1', 'INVALID');
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_RANGE');
  });

  it('should return 404 for non-existent auditId', async () => {
    const event = createMockEvent('non-existent', '1D');
    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AUDIT_NOT_FOUND');
  });

  it('should return 400 for missing parameters', async () => {
    const event = createMockEvent('', '');
    event.pathParameters = null;
    event.queryStringParameters = null;
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return candles with correct structure', async () => {
    const event = createMockEvent('a1', '1D');
    const result = await handler(event);

    const body = JSON.parse(result.body);
    const candle = body.data.candles[0];

    expect(candle).toHaveProperty('timestamp');
    expect(candle).toHaveProperty('open');
    expect(candle).toHaveProperty('high');
    expect(candle).toHaveProperty('low');
    expect(candle).toHaveProperty('close');
    expect(candle).toHaveProperty('failures');

    expect(candle.open).toBeGreaterThanOrEqual(0);
    expect(candle.open).toBeLessThanOrEqual(1);
    expect(candle.high).toBeGreaterThanOrEqual(candle.low);
    expect(candle.failures).toBeGreaterThanOrEqual(0);
  });

  it('should return candles sorted by timestamp ascending', async () => {
    const event = createMockEvent('a1', '1D');
    const result = await handler(event);

    const body = JSON.parse(result.body);
    const candles = body.data.candles;

    for (let i = 1; i < candles.length; i++) {
      const prevTimestamp = new Date(candles[i - 1].timestamp).getTime();
      const currTimestamp = new Date(candles[i].timestamp).getTime();
      expect(currTimestamp).toBeGreaterThan(prevTimestamp);
    }
  });
});

