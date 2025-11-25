# Winking Owl Audits API - Backend

Backend API para la aplicación móvil Winking Owl Audits, implementado con AWS API Gateway y Lambda Functions.

**⚠️ Versión MOCK**: Esta es la versión inicial que genera datos aleatorios. No utiliza base de datos real.

## 📋 Características

- ✅ 3 Endpoints REST API
- ✅ Autenticación con AWS Cognito
- ✅ Generación de datos mock aleatorios
- ✅ TypeScript
- ✅ Tests unitarios con Jest
- ✅ Infraestructura como código con AWS SAM

## 🏗️ Arquitectura

```
API Gateway → Lambda Functions (Mock Data Generation)
```

- **GetAuditsFunction**: Lista todas las auditorías
- **GetAuditByIdFunction**: Detalle de una auditoría
- **GetCandlesFunction**: Velas históricas por rango de tiempo

## 📦 Requisitos Previos

- Node.js 20.x o superior
- AWS CLI configurado
- AWS SAM CLI instalado
- Cuenta de AWS con permisos adecuados
- Cognito User Pool creado

### Instalar AWS SAM CLI

```bash
# macOS
brew install aws-sam-cli

# Linux
pip install aws-sam-cli

# Windows
# Descargar desde: https://github.com/aws/aws-sam-cli/releases
```

## 🚀 Instalación

1. **Clonar el repositorio** (si aplica)
   ```bash
   git clone <repository-url>
   cd rork-winking-owl-audits-api
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar Cognito User Pool ID**
   
   Editar `samconfig.toml` y reemplazar `YOUR_COGNITO_USER_POOL_ID` con tu User Pool ID real:
   ```toml
   parameter_overrides = [
       "CognitoUserPoolId=us-east-1_XXXXXXXXX"
   ]
   ```

## 🧪 Desarrollo Local

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Watch mode
npm run test:watch

# Con coverage
npm run test:coverage
```

### Linting

```bash
# Verificar
npm run lint

# Auto-fix
npm run lint:fix
```

### Probar Localmente con SAM

```bash
# Iniciar API local
npm run local:start

# La API estará disponible en http://127.0.0.1:3000
```

**Nota**: Para probar con autenticación Cognito localmente, necesitarás configurar un mock authorizer o deshabilitar temporalmente la autenticación.

## 📝 Endpoints

### Base URL
```
https://{api-id}.execute-api.{region}.amazonaws.com/{stage}/
```

### 1. GET /audits

Obtiene la lista de todas las auditorías.

**Headers**:
```
Authorization: Bearer {accessToken}
```

**Response**:
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
      }
    ]
  },
  "timestamp": "2024-12-15T10:30:00.000Z"
}
```

### 2. GET /audits/{auditId}

Obtiene el detalle de una auditoría específica.

**Path Parameters**:
- `auditId` (string, required)

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
    }
  },
  "timestamp": "2024-12-15T10:30:00.000Z"
}
```

**Response 404**:
```json
{
  "success": false,
  "error": {
    "code": "AUDIT_NOT_FOUND",
    "message": "Audit with id 'xxx' not found"
  }
}
```

### 3. GET /audits/{auditId}/candles

Obtiene las velas históricas para una auditoría.

**Path Parameters**:
- `auditId` (string, required)

**Query Parameters**:
- `range` (string, required): `1H`, `1D`, `1W`, `1M`, `3M`, `1Y`

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
      }
    ]
  },
  "timestamp": "2024-12-15T10:30:00.000Z"
}
```

## 🚢 Deployment

### Build

```bash
npm run build
```

### Deploy a Desarrollo

```bash
npm run deploy:dev
```

### Deploy a Producción

```bash
npm run deploy:prod
```

### Deploy Manual

```bash
sam build
sam deploy --guided
```

## 📁 Estructura del Proyecto

```
rork-winking-owl-audits-api/
├── functions/
│   ├── get-audits/
│   │   ├── index.ts
│   │   └── get-audits.test.ts
│   ├── get-audit-by-id/
│   │   ├── index.ts
│   │   └── get-audit-by-id.test.ts
│   └── get-candles/
│       ├── index.ts
│       └── get-candles.test.ts
├── shared/
│   ├── types.ts
│   ├── mock-data.ts
│   └── utils.ts
├── template.yaml          # SAM template
├── samconfig.toml        # SAM configuration
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Configuración

### Variables de Entorno

No se requieren variables de entorno en la versión MOCK. Todas las configuraciones están en `template.yaml` y `samconfig.toml`.

### Cognito User Pool

Asegúrate de tener:
1. Un Cognito User Pool creado
2. El User Pool ID configurado en `samconfig.toml`
3. Un App Client configurado en el User Pool

## 🧪 Testing

Los tests están ubicados junto a cada función Lambda:

```bash
functions/get-audits/get-audits.test.ts
functions/get-audit-by-id/get-audit-by-id.test.ts
functions/get-candles/get-candles.test.ts
```

Ejecutar todos los tests:
```bash
npm test
```

## 📊 Monitoreo

Una vez desplegado, puedes monitorear:

- **CloudWatch Logs**: Logs de cada Lambda function
- **CloudWatch Metrics**: Métricas de invocaciones, errores, duración
- **API Gateway**: Métricas de requests, latencia, errores

## 🔐 Seguridad

- Autenticación mediante AWS Cognito User Pool
- Tokens JWT validados por API Gateway
- HTTPS/TLS obligatorio
- Rate limiting configurado en API Gateway

## 📚 Documentación Adicional

Ver `BACKEND_SPECIFICATION.md` para la especificación técnica completa.

## 🐛 Troubleshooting

### Error: "CognitoUserPoolId not found"
- Verifica que el User Pool ID esté correctamente configurado en `samconfig.toml`

### Error: "Unauthorized"
- Verifica que el token JWT sea válido
- Verifica que el User Pool esté correctamente configurado en API Gateway

### Error en deployment
- Verifica permisos de AWS CLI
- Verifica que SAM CLI esté instalado correctamente
- Revisa los logs en CloudWatch

## 📝 Notas

- Esta es una versión MOCK que genera datos aleatorios
- No se utiliza base de datos real
- Los datos varían en cada request para simular datos en tiempo real
- Para migrar a datos reales, ver sección "Migración a Datos Reales" en `BACKEND_SPECIFICATION.md`

## 📄 Licencia

ISC

---

**Última actualización**: Diciembre 2024

