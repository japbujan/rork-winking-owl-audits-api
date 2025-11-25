# Especificación Técnica del Backend - Winking Owl Audits API

## 📋 Índice
1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura AWS](#arquitectura-aws)
3. [Autenticación y Autorización](#autenticación-y-autorización)
4. [Endpoints de la API](#endpoints-de-la-api)
5. [Modelos de Datos](#modelos-de-datos)
6. [Estructura de Respuestas](#estructura-de-respuestas)
7. [Manejo de Errores](#manejo-de-errores)
8. [Configuración de API Gateway](#configuración-de-api-gateway)
9. [Configuración de Lambda Functions](#configuración-de-lambda-functions)
10. [Base de Datos](#base-de-datos)
11. [Consideraciones de Performance](#consideraciones-de-performance)
12. [Seguridad](#seguridad)
13. [Monitoreo y Logging](#monitoreo-y-logging)
14. [Plan de Implementación](#plan-de-implementación)

---

## Resumen Ejecutivo

Este documento especifica los requisitos técnicos para desarrollar el backend de la aplicación móvil **Winking Owl Audits** utilizando **AWS API Gateway** y **AWS Lambda**.

**⚠️ IMPORTANTE: Versión MOCK**
Esta es la **versión inicial (MVP)** que genera datos aleatorios/mock. **NO se utiliza base de datos real** ni infraestructura de almacenamiento. Todas las respuestas se generan dinámicamente con datos simulados.

**Stack Tecnológico**:
- **API Gateway**: REST API con autorización Cognito
- **Lambda**: Node.js 20.x (TypeScript recomendado)
- **Autenticación**: AWS Cognito User Pool
- **Datos**: Generación aleatoria en memoria (MOCK)
- **Monitoreo**: CloudWatch Logs y Metrics

**Funcionalidades Principales**:
1. Autenticación mediante AWS Cognito (manejado por Cognito directamente)
2. Lista de auditorías con datos mock generados aleatoriamente
3. Detalle de auditoría individual (datos mock)
4. Datos históricos de velas (candlesticks) generados dinámicamente por rango de tiempo
5. Polling optimizado según rango de tiempo

---

## Arquitectura AWS

### Diagrama de Arquitectura

```
┌─────────────────┐
│  Mobile App     │
│  (React Native) │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────────────────────────┐
│      AWS API Gateway                │
│  - REST API                         │
│  - Cognito Authorizer               │
│  - Rate Limiting                    │
│  - CORS                             │
└────────┬────────────────────────────┘
         │
         ├─────────────────┬─────────────────┐
         ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Lambda     │  │   Lambda     │  │   Lambda     │
│  GetAudits   │  │ GetAuditById │  │ GetCandles   │
│  (MOCK)      │  │   (MOCK)     │  │   (MOCK)     │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┴─────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   Generación de      │
              │   Datos Aleatorios   │
              │   (In-Memory)        │
              └──────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   CloudWatch Logs    │
              └──────────────────────┘
```

### Componentes Principales

1. **API Gateway REST API**
   - Endpoint único: `https://api.winking-owl.com/v1`
   - Autorización mediante Cognito User Pool
   - Rate limiting: 1000 requests/min por usuario
   - CORS habilitado para dominio móvil

2. **Lambda Functions (MOCK)**
   - `GetAuditsFunction`: Genera lista de auditorías con datos aleatorios
   - `GetAuditByIdFunction`: Genera detalle de auditoría mock
   - `GetCandlesFunction`: Genera velas históricas aleatorias por rango

3. **Generación de Datos Mock**
   - Datos generados dinámicamente en memoria
   - Variación aleatoria en cada request (simula datos en tiempo real)
   - No requiere base de datos ni almacenamiento persistente

**Nota**: Esta versión NO utiliza DynamoDB, ElastiCache ni ninguna base de datos. Todos los datos se generan aleatoriamente en las Lambdas.

---

## Autenticación y Autorización

### AWS Cognito User Pool

**Nota**: La autenticación se maneja directamente por AWS Cognito. El backend solo valida tokens JWT.

**Flujo de Autenticación**:
1. Cliente autentica con Cognito (fuera del scope de este backend)
2. Cliente recibe tokens: `accessToken`, `idToken`, `refreshToken`
3. Cliente envía `Authorization: Bearer {accessToken}` en cada request
4. API Gateway valida el token con Cognito Authorizer
5. Lambda recibe el token validado en el contexto

### Cognito Authorizer en API Gateway

**Configuración**:
- **Type**: Cognito User Pool
- **User Pool**: `winking-owl-user-pool`
- **Token Source**: `Authorization` header
- **Authorization Scopes**: `audits:read`

### Validación de Token en Lambda

Aunque API Gateway valida el token, las Lambdas pueden acceder a:
- `event.requestContext.authorizer.claims.sub` (User ID)
- `event.requestContext.authorizer.claims.email`
- `event.requestContext.authorizer.claims['cognito:username']`

---

## Endpoints de la API

### Base URL
```
https://api.winking-owl.com/v1
```

### Headers Requeridos
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

---

### 1. GET /audits

**Descripción**: Obtiene la lista de todas las auditorías con sus métricas agregadas.

**Autenticación**: Requerida (Cognito)

**Query Parameters**: Ninguno

**Response 200**:
```json
{
  "success": true,
  "data": {
    "audits": [
      {
        "id": "a1",
        "name": "Checkout Web",
        "status": "ok",
        "successRate": 0.972,
        "executions": 842,
        "failures": 23,
        "lastUpdate": "2024-12-15T10:30:00.000Z"
      },
      {
        "id": "a2",
        "name": "Onboarding App",
        "status": "fail",
        "successRate": 0.741,
        "executions": 590,
        "failures": 153,
        "lastUpdate": "2024-12-15T10:29:45.000Z"
      }
    ],
    "timestamp": "2024-12-15T10:30:00.000Z"
  }
}
```

**Lógica de Negocio (MOCK)**:
- Generar lista de 8 auditorías predefinidas con IDs: `a1`, `a2`, ..., `a8`
- Nombres predefinidos: "Checkout Web", "Onboarding App", "Payment Flow", "User Profile", "Search API", "Auth Service", "Notification System", "Data Export"
- Para cada auditoría, generar valores aleatorios:
  - `successRate`: Valor base ± variación aleatoria (0.02)
  - `executions`: Valor base + variación aleatoria (0-10)
  - `failures`: Valor base + variación aleatoria (0-3)
  - `lastUpdate`: Timestamp actual (ISO 8601)
- Calcular `status` basado en `successRate`:
  - `"ok"`: successRate ≥ 0.95
  - `"fail"`: 0.80 ≤ successRate < 0.95
  - `"error"`: successRate < 0.80
- Ordenar alfabéticamente por `name`
- **No usar caché** - generar datos frescos en cada request (simula datos en tiempo real)

**Polling**: El cliente hace polling cada 20 segundos

---

### 2. GET /audits/{auditId}

**Descripción**: Obtiene el detalle completo de una auditoría específica.

**Autenticación**: Requerida (Cognito)

**Path Parameters**:
- `auditId` (string, required): ID de la auditoría

**Response 200**:
```json
{
  "success": true,
  "data": {
    "audit": {
      "id": "a1",
      "name": "Checkout Web",
      "status": "ok",
      "successRate": 0.972,
      "executions": 842,
      "failures": 23,
      "lastUpdate": "2024-12-15T10:30:00.000Z"
    },
    "timestamp": "2024-12-15T10:30:00.000Z"
  }
}
```

**Response 404**:
```json
{
  "success": false,
  "error": {
    "code": "AUDIT_NOT_FOUND",
    "message": "Audit with id 'a1' not found"
  }
}
```

**Lógica de Negocio (MOCK)**:
- Validar que `auditId` existe (debe ser uno de: `a1`, `a2`, ..., `a8`)
- Generar datos mock para la auditoría solicitada con variación aleatoria
- Retornar datos actualizados (simulando datos en tiempo real)
- **No usar caché** - generar datos frescos en cada request

---

### 3. GET /audits/{auditId}/candles

**Descripción**: Obtiene los datos históricos de velas (candlesticks) para una auditoría en un rango de tiempo específico.

**Autenticación**: Requerida (Cognito)

**Path Parameters**:
- `auditId` (string, required): ID de la auditoría

**Query Parameters**:
- `range` (string, required): Rango de tiempo. Valores: `"1H"`, `"1D"`, `"1W"`, `"1M"`, `"3M"`, `"1Y"`

**Response 200**:
```json
{
  "success": true,
  "data": {
    "auditId": "a1",
    "range": "1D",
    "candles": [
      {
        "timestamp": "2024-12-15T00:00:00.000Z",
        "open": 0.970,
        "high": 0.975,
        "low": 0.968,
        "close": 0.972,
        "failures": 2
      },
      {
        "timestamp": "2024-12-15T01:00:00.000Z",
        "open": 0.972,
        "high": 0.978,
        "low": 0.971,
        "close": 0.976,
        "failures": 1
      }
    ],
    "timestamp": "2024-12-15T10:30:00.000Z"
  }
}
```

**Response 400** (Bad Request):
```json
{
  "success": false,
  "error": {
    "code": "INVALID_RANGE",
    "message": "Range must be one of: 1H, 1D, 1W, 1M, 3M, 1Y"
  }
}
```

**Response 404**:
```json
{
  "success": false,
  "error": {
    "code": "AUDIT_NOT_FOUND",
    "message": "Audit with id 'a1' not found"
  }
}
```

**Lógica de Negocio (MOCK)**:

1. **Validar `range`**: Debe ser uno de los valores permitidos (`1H`, `1D`, `1W`, `1M`, `3M`, `1Y`)
2. **Validar `auditId`**: Debe existir (uno de: `a1`, `a2`, ..., `a8`)
3. **Obtener `successRate` base**: Usar el `successRate` base de la auditoría (predefinido por ID)
4. **Calcular intervalo y cantidad de velas**:
   - `1H`: 12 velas, intervalo 5 minutos
   - `1D`: 24 velas, intervalo 1 hora
   - `1W`: 42 velas, intervalo 4 horas
   - `1M`: 30 velas, intervalo 1 día
   - `3M`: 90 velas, intervalo 1 día
   - `1Y`: 52 velas, intervalo 1 semana

5. **Generar timestamps**: Desde el momento actual hacia atrás según el intervalo
6. **Generar velas aleatorias**:
   - Para cada período, generar valores OHLC aleatorios:
     - `open`: `baseSuccessRate + variación aleatoria (-0.05 a +0.05)`
     - `close`: `open + tendencia + variación aleatoria`
     - `high`: `max(open, close) + variación aleatoria (0 a 0.03)`
     - `low`: `min(open, close) - variación aleatoria (0 a 0.03)`
     - `failures`: Número aleatorio entre 0 y 5
   - Asegurar que todos los valores estén entre 0.0 y 1.0
   - Aplicar una ligera tendencia temporal (mejora gradual hacia el presente)

7. **Ordenar**: Velas ordenadas por `timestamp` ascendente
8. **No usar caché** - generar datos frescos en cada request (simula datos en tiempo real)

**Polling**:
- Cliente hace polling cada 20s para rangos 1H/1D
- Cliente hace polling cada 60s para rangos ≥1W

---

## Modelos de Datos

### Audit

```typescript
interface Audit {
  id: string;                    // UUID o identificador único
  name: string;                  // Nombre descriptivo de la auditoría
  status: "ok" | "fail" | "error"; // Estado calculado
  successRate: number;            // 0.0 - 1.0 (porcentaje de éxito)
  executions: number;             // Total de ejecuciones
  failures: number;              // Total de fallos
  lastUpdate: string;            // ISO 8601 timestamp (UTC)
}
```

**Cálculo de `status`**:
- `"ok"`: `successRate >= 0.95`
- `"fail"`: `0.80 <= successRate < 0.95`
- `"error"`: `successRate < 0.80`

### Candle

```typescript
interface Candle {
  timestamp: string;             // ISO 8601 timestamp (UTC), inicio del período
  open: number;                   // 0.0 - 1.0 (successRate inicial)
  high: number;                   // 0.0 - 1.0 (mayor successRate del período)
  low: number;                    // 0.0 - 1.0 (menor successRate del período)
  close: number;                  // 0.0 - 1.0 (successRate final)
  failures: number;              // Cantidad de fallos en el período
}
```

### Execution (Datos Raw en Base de Datos)

```typescript
interface Execution {
  id: string;                    // UUID
  auditId: string;               // FK a Audit
  timestamp: string;             // ISO 8601 timestamp (UTC)
  success: boolean;              // true si pasó, false si falló
  duration?: number;             // Duración en ms (opcional)
  errorMessage?: string;        // Mensaje de error si falló (opcional)
  metadata?: Record<string, any>; // Datos adicionales (opcional)
}
```

---

## Estructura de Respuestas

### Respuesta Exitosa

```json
{
  "success": true,
  "data": {
    // Datos específicos del endpoint
  },
  "timestamp": "2024-12-15T10:30:00.000Z"
}
```

### Respuesta de Error

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### Códigos de Error Estándar

| Código | HTTP Status | Descripción |
|--------|-------------|-------------|
| `AUDIT_NOT_FOUND` | 404 | La auditoría no existe |
| `INVALID_RANGE` | 400 | El rango de tiempo no es válido |
| `UNAUTHORIZED` | 401 | Token inválido o expirado |
| `FORBIDDEN` | 403 | Usuario no tiene permisos |
| `INTERNAL_ERROR` | 500 | Error interno del servidor |
| `VALIDATION_ERROR` | 400 | Error de validación de parámetros |

---

## Manejo de Errores

### En Lambda Functions

**Estructura de Error**:
```typescript
interface ApiError {
  code: string;
  message: string;
  details?: any;
}
```

**Ejemplo de manejo**:
```typescript
try {
  // Lógica de negocio
} catch (error) {
  if (error instanceof ValidationError) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message
        }
      })
    };
  }
  
  // Error genérico
  return {
    statusCode: 500,
    body: JSON.stringify({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred"
      }
    })
  };
}
```

### Logging

Todas las Lambdas deben loguear:
- Request ID (de API Gateway)
- User ID (de Cognito)
- Timestamp
- Errores con stack trace

---

## Configuración de API Gateway

### REST API

**Configuración Base**:
- **Name**: `winking-owl-audits-api`
- **Protocol**: HTTPS only
- **API Type**: REST
- **Endpoint Type**: Regional (o Edge si se requiere)

### Resources y Methods

```
/audits
  GET /audits
    - Authorization: Cognito User Pool
    - Integration: Lambda (GetAuditsFunction)
    
  GET /audits/{auditId}
    - Authorization: Cognito User Pool
    - Integration: Lambda (GetAuditByIdFunction)
    
  GET /audits/{auditId}/candles
    - Authorization: Cognito User Pool
    - Integration: Lambda (GetCandlesFunction)
    - Query Parameters: range
```

### CORS Configuration

```json
{
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Max-Age": "3600"
}
```

### Rate Limiting

- **Default**: 1000 requests/min por usuario
- **Burst**: 2000 requests/min
- Implementar mediante Usage Plans y API Keys (opcional) o Throttle Settings

### Request/Response Models

**Request Model** (para validación):
```json
{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "type": "object",
  "properties": {
    "range": {
      "type": "string",
      "enum": ["1H", "1D", "1W", "1M", "3M", "1Y"]
    }
  },
  "required": ["range"]
}
```

---

## Configuración de Lambda Functions

### GetAuditsFunction

**Runtime**: Node.js 20.x  
**Memory**: 256 MB  
**Timeout**: 10 segundos  
**Environment Variables**: Ninguna (versión MOCK)

**IAM Role Permissions**: Ninguna (no accede a servicios AWS)

**Handler**:
```typescript
export const handler = async (event: APIGatewayProxyEvent) => {
  // 1. Cargar datos base predefinidos
  // 2. Generar variación aleatoria para cada auditoría
  // 3. Calcular status basado en successRate
  // 4. Ordenar alfabéticamente
  // 5. Retornar respuesta
};
```

### GetAuditByIdFunction

**Runtime**: Node.js 20.x  
**Memory**: 256 MB  
**Timeout**: 10 segundos  
**Environment Variables**: Ninguna (versión MOCK)

**IAM Role Permissions**: Ninguna (no accede a servicios AWS)

**Handler**:
```typescript
export const handler = async (event: APIGatewayProxyEvent) => {
  const auditId = event.pathParameters?.auditId;
  // 1. Validar auditId
  // 2. Buscar en datos base predefinidos
  // 3. Si no existe, retornar 404
  // 4. Generar datos mock con variación aleatoria
  // 5. Retornar respuesta
};
```

### GetCandlesFunction

**Runtime**: Node.js 20.x  
**Memory**: 256 MB (suficiente para generación mock)  
**Timeout**: 10 segundos  
**Environment Variables**: Ninguna (versión MOCK)

**IAM Role Permissions**: Ninguna (no accede a servicios AWS)

**Handler**:
```typescript
export const handler = async (event: APIGatewayProxyEvent) => {
  const auditId = event.pathParameters?.auditId;
  const range = event.queryStringParameters?.range;
  
  // 1. Validar auditId y range
  // 2. Verificar que audit existe en datos base
  // 3. Obtener successRate base de la auditoría
  // 4. Calcular intervalo y cantidad de velas según range
  // 5. Generar timestamps desde ahora hacia atrás
  // 6. Para cada período, generar valores OHLC aleatorios
  // 7. Aplicar tendencia temporal
  // 8. Retornar respuesta
};
```

---

## Base de Datos

### ⚠️ Versión MOCK - Sin Base de Datos

**Esta versión NO utiliza base de datos**. Todos los datos se generan aleatoriamente en memoria dentro de las Lambda Functions.

### Datos Predefinidos (Hardcoded en Lambda)

Las Lambdas contienen datos base predefinidos para generar respuestas mock:

```typescript
const MOCK_AUDITS_BASE = [
  { id: "a1", name: "Checkout Web", baseSuccessRate: 0.972 },
  { id: "a2", name: "Onboarding App", baseSuccessRate: 0.741 },
  { id: "a3", name: "Payment Flow", baseSuccessRate: 0.988 },
  { id: "a4", name: "User Profile", baseSuccessRate: 0.956 },
  { id: "a5", name: "Search API", baseSuccessRate: 0.812 },
  { id: "a6", name: "Auth Service", baseSuccessRate: 0.998 },
  { id: "a7", name: "Notification System", baseSuccessRate: 0.923 },
  { id: "a8", name: "Data Export", baseSuccessRate: 0.654 },
];
```

### Nota para Versión Futura

Cuando se implemente la versión con datos reales, se recomienda:
- **DynamoDB** para almacenamiento serverless
- O **RDS PostgreSQL** si se requiere SQL
- Ver sección "Migración a Datos Reales" al final del documento

---

## Consideraciones de Performance

### ⚠️ Versión MOCK - Sin Caché

**Esta versión NO utiliza caché**. Los datos se generan en cada request para simular datos en tiempo real. Esto es intencional para la versión MOCK.

### Optimizaciones para MOCK

1. **Generación Eficiente**:
   - Usar funciones de generación aleatoria eficientes (Math.random() es suficiente)
   - Pre-calcular estructuras base de datos en variables estáticas
   - Minimizar cálculos repetitivos

2. **Compresión**:
   - Habilitar compresión en API Gateway para respuestas grandes (velas)

3. **Cold Start Mitigation**:
   - Usar Lambda Provisioned Concurrency opcionalmente (no crítico para MOCK)
   - Mantener código simple y sin dependencias pesadas

### Nota para Versión Futura

Cuando se implemente la versión con datos reales:
- Implementar **ElastiCache (Redis)** para caché
- TTLs: Auditorías 10s, Velas cortas 5s, Velas largas 30s
- Ver sección "Migración a Datos Reales" al final del documento

### Límites y Cuotas

- **API Gateway**: 10,000 requests/segundo (default)
- **Lambda**: 1,000 ejecuciones concurrentes (default, puede aumentar)
- **DynamoDB**: On-Demand scaling automático
- **ElastiCache**: Depende del tipo de instancia

---

## Seguridad

### Autenticación

- **Cognito User Pool**: Validación de tokens JWT
- **API Gateway Authorizer**: Valida token antes de invocar Lambda
- **Token Expiration**: Tokens expiran según configuración de Cognito (default: 1 hora)

### Autorización

- Solo usuarios autenticados pueden acceder a los endpoints
- No hay roles diferenciados en esta versión (todos los usuarios ven todas las auditorías)

### Data Protection

- **En Tránsito**: HTTPS/TLS 1.2+
- **En Reposo**: DynamoDB encryption at rest
- **Secrets**: Usar AWS Secrets Manager para credenciales de Redis

### Rate Limiting

- **Por Usuario**: 1000 requests/minuto
- **Burst**: 2000 requests/minuto
- Implementar throttling en API Gateway

### Input Validation

- Validar todos los parámetros de entrada
- Sanitizar strings para prevenir inyección
- Validar formatos de fecha y rangos numéricos

---

## Monitoreo y Logging

### CloudWatch Logs

**Log Groups**:
- `/aws/lambda/GetAuditsFunction`
- `/aws/lambda/GetAuditByIdFunction`
- `/aws/lambda/GetCandlesFunction`
- `/aws/apigateway/winking-owl-audits-api`

**Log Retention**: 30 días (configurable)

### CloudWatch Metrics

**Métricas a Monitorear**:
- Lambda: Invocations, Errors, Duration, Throttles
- API Gateway: Count, Latency, 4XXError, 5XXError
- DynamoDB: Read/Write throttles, ConsumedReadCapacityUnits
- ElastiCache: CacheHits, CacheMisses, CPUUtilization

### Alarmas Recomendadas

1. **Lambda Errors > 10 en 5 minutos**
2. **API Gateway 5XX Errors > 5%**
3. **Lambda Duration > 80% del timeout**
4. **DynamoDB Throttles > 0**
5. **ElastiCache CPU > 80%**

### Distributed Tracing

- Habilitar AWS X-Ray para tracing de requests
- Ver flujo completo: API Gateway → Lambda → DynamoDB/Redis

---

## Plan de Implementación

### Fase 1: Infraestructura Base (Semana 1)

1. **Crear Cognito User Pool**
   - Configurar app client
   - Configurar dominio para login
   - Crear usuarios de prueba

2. **Crear IAM Roles**
   - Role básico para Lambdas (sin permisos de base de datos, solo CloudWatch Logs)
   - Permisos mínimos: `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`

**Nota**: NO se crean DynamoDB ni ElastiCache en esta versión MOCK

### Fase 2: Lambda Functions (Semana 2)

1. **GetAuditsFunction**
   - Implementar generación de datos mock
   - Definir datos base predefinidos
   - Generar variación aleatoria
   - Tests unitarios

2. **GetAuditByIdFunction**
   - Implementar generación de datos mock
   - Validación de auditId
   - Manejo de errores 404
   - Tests unitarios

3. **GetCandlesFunction**
   - Implementar generación de velas mock
   - Lógica de generación OHLC aleatoria
   - Manejo de diferentes rangos
   - Aplicar tendencias temporales
   - Tests unitarios

### Fase 3: API Gateway (Semana 3)

1. **Crear REST API**
   - Configurar recursos y métodos
   - Configurar Cognito Authorizer
   - Configurar CORS

2. **Integrar Lambdas**
   - Configurar integrations
   - Configurar request/response mappings
   - Configurar error responses

3. **Configurar Rate Limiting**
   - Crear Usage Plans
   - Configurar throttling

### Fase 4: Testing y Optimización (Semana 4)

1. **Testing**
   - Tests de integración
   - Load testing
   - Security testing

2. **Optimización**
   - Optimizar generación de datos mock
   - Ajustar Lambda memory/timeout si es necesario
   - Verificar tiempos de respuesta

3. **Monitoreo**
   - Configurar CloudWatch dashboards
   - Configurar alarmas
   - Habilitar X-Ray

### Fase 5: Producción (Semana 5)

1. **Deployment**
   - Crear stage de producción
   - Configurar custom domain
   - Configurar SSL certificate

2. **Documentación**
   - Documentar endpoints (OpenAPI/Swagger)
   - Documentar procesos de deployment

3. **Go-Live**
   - Deploy a producción
   - Monitoreo activo
   - Rollback plan

---

## Ejemplo de Implementación Lambda (TypeScript)

### GetAuditsFunction

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

interface Audit {
  id: string;
  name: string;
  status: 'ok' | 'fail' | 'error';
  successRate: number;
  executions: number;
  failures: number;
  lastUpdate: string;
}

// Datos base predefinidos
const MOCK_AUDITS_BASE = [
  { id: 'a1', name: 'Checkout Web', baseSuccessRate: 0.972, baseExecutions: 842, baseFailures: 23 },
  { id: 'a2', name: 'Onboarding App', baseSuccessRate: 0.741, baseExecutions: 590, baseFailures: 153 },
  { id: 'a3', name: 'Payment Flow', baseSuccessRate: 0.988, baseExecutions: 1250, baseFailures: 15 },
  { id: 'a4', name: 'User Profile', baseSuccessRate: 0.956, baseExecutions: 720, baseFailures: 32 },
  { id: 'a5', name: 'Search API', baseSuccessRate: 0.812, baseExecutions: 450, baseFailures: 85 },
  { id: 'a6', name: 'Auth Service', baseSuccessRate: 0.998, baseExecutions: 2100, baseFailures: 4 },
  { id: 'a7', name: 'Notification System', baseSuccessRate: 0.923, baseExecutions: 890, baseFailures: 69 },
  { id: 'a8', name: 'Data Export', baseSuccessRate: 0.654, baseExecutions: 320, baseFailures: 111 },
];

function calculateStatus(successRate: number): 'ok' | 'fail' | 'error' {
  if (successRate >= 0.95) return 'ok';
  if (successRate >= 0.80) return 'fail';
  return 'error';
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
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
        successRate: Math.round(successRate * 1000) / 1000, // 3 decimales
        executions,
        failures,
        lastUpdate: new Date().toISOString(),
      };
    });

    // Ordenar alfabéticamente
    audits.sort((a, b) => a.name.localeCompare(b.name));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          audits,
          timestamp: new Date().toISOString(),
        },
      }),
    };
  } catch (error) {
    console.error('Error getting audits:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred',
        },
      }),
    };
  }
};
```

### GetCandlesFunction (Ejemplo)

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  failures: number;
}

type TimeRange = '1H' | '1D' | '1W' | '1M' | '3M' | '1Y';

const RANGE_CONFIG: Record<TimeRange, { count: number; intervalMs: number }> = {
  '1H': { count: 12, intervalMs: 5 * 60 * 1000 },
  '1D': { count: 24, intervalMs: 60 * 60 * 1000 },
  '1W': { count: 42, intervalMs: 4 * 60 * 60 * 1000 },
  '1M': { count: 30, intervalMs: 24 * 60 * 60 * 1000 },
  '3M': { count: 90, intervalMs: 24 * 60 * 60 * 1000 },
  '1Y': { count: 52, intervalMs: 7 * 24 * 60 * 60 * 1000 },
};

// Success rates base por auditId (debe coincidir con GetAuditsFunction)
const BASE_SUCCESS_RATES: Record<string, number> = {
  a1: 0.972, a2: 0.741, a3: 0.988, a4: 0.956,
  a5: 0.812, a6: 0.998, a7: 0.923, a8: 0.654,
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const auditId = event.pathParameters?.auditId;
    const range = event.queryStringParameters?.range as TimeRange;

    // Validaciones
    if (!auditId || !range) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'auditId and range are required' },
        }),
      };
    }

    if (!Object.keys(RANGE_CONFIG).includes(range)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: { code: 'INVALID_RANGE', message: 'Range must be one of: 1H, 1D, 1W, 1M, 3M, 1Y' },
        }),
      };
    }

    const baseSuccessRate = BASE_SUCCESS_RATES[auditId];
    if (!baseSuccessRate) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: { code: 'AUDIT_NOT_FOUND', message: `Audit with id '${auditId}' not found` },
        }),
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
        open: Math.round(open * 1000) / 1000,
        high: Math.round(high * 1000) / 1000,
        low: Math.round(low * 1000) / 1000,
        close: Math.round(close * 1000) / 1000,
        failures,
      });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        data: {
          auditId,
          range,
          candles,
          timestamp: new Date().toISOString(),
        },
      }),
    };
  } catch (error) {
    console.error('Error getting candles:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
      }),
    };
  }
};
```

---

## Checklist de Implementación

### Infraestructura
- [ ] Cognito User Pool creado y configurado
- [ ] IAM roles y políticas configuradas (mínimas, solo CloudWatch Logs)
- [ ] **NO crear DynamoDB** (versión MOCK)
- [ ] **NO crear ElastiCache** (versión MOCK)

### Lambda Functions
- [ ] GetAuditsFunction implementada con generación mock
- [ ] GetAuditByIdFunction implementada con generación mock
- [ ] GetCandlesFunction implementada con generación mock
- [ ] Datos base predefinidos definidos
- [ ] Manejo de errores implementado
- [ ] Logging configurado
- [ ] Tests unitarios para generación de datos mock

### API Gateway
- [ ] REST API creada
- [ ] Resources y methods configurados
- [ ] Cognito Authorizer configurado
- [ ] Integrations con Lambdas configuradas
- [ ] CORS configurado
- [ ] Rate limiting configurado
- [ ] Custom domain configurado (producción)

### Testing
- [ ] Tests unitarios para cada Lambda
- [ ] Tests de integración
- [ ] Load testing realizado
- [ ] Security testing realizado

### Monitoreo
- [ ] CloudWatch dashboards creados
- [ ] Alarmas configuradas
- [ ] X-Ray habilitado
- [ ] Log retention configurado

### Documentación
- [ ] OpenAPI/Swagger documentado
- [ ] README con instrucciones de deployment
- [ ] Runbook para operaciones

---

## Migración a Datos Reales (Futuro)

Cuando se implemente la versión con datos reales, se debe:

1. **Crear DynamoDB Tables**:
   - Tabla `audits` con estructura definida anteriormente
   - Tabla `executions` con GSI `auditId-timestamp-index`
   - Configurar TTL en `executions`

2. **Crear ElastiCache Cluster**:
   - Tipo Redis
   - Configurar VPC si es necesario

3. **Actualizar Lambda Functions**:
   - Reemplazar generación mock con queries a DynamoDB
   - Implementar lógica de caché con Redis
   - Actualizar IAM roles con permisos necesarios

4. **Actualizar Environment Variables**:
   - Agregar `AUDITS_TABLE_NAME`, `EXECUTIONS_TABLE_NAME`
   - Agregar `REDIS_ENDPOINT`
   - Agregar TTLs de caché

5. **Mantener Compatibilidad**:
   - Mantener misma estructura de respuestas
   - No cambiar endpoints ni modelos de datos

## Notas Finales

- **Versionado**: Considerar versionar la API (`/v1/`, `/v2/`) para futuras actualizaciones
- **Backwards Compatibility**: Mantener compatibilidad con versiones anteriores
- **Cost Optimization**: Versión MOCK tiene costos mínimos (solo Lambda + API Gateway)
- **Scaling**: Planificar escalado automático según demanda
- **Testing**: La versión MOCK es ideal para testing y desarrollo sin infraestructura compleja

---

**Última actualización**: Diciembre 2024  
**Versión del Documento**: 1.0 (MOCK Version)

