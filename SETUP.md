# Setup Rápido - Winking Owl Audits API

## Pasos Iniciales

### 1. Instalar Dependencias

```bash
cd rork-winking-owl-audits-api
npm install
```

### 2. Configurar AWS

Asegúrate de tener AWS CLI configurado:

```bash
aws configure
```

### 3. Crear Cognito User Pool (si no existe)

```bash
# Opción 1: Desde AWS Console
# Ve a AWS Cognito → Create User Pool

# Opción 2: Desde CLI (ejemplo)
aws cognito-idp create-user-pool \
  --pool-name winking-owl-user-pool \
  --auto-verified-attributes email
```

**Obtén el User Pool ID** de la respuesta o desde la consola.

### 4. Configurar User Pool ID

Edita `samconfig.toml` y reemplaza `YOUR_COGNITO_USER_POOL_ID`:

```toml
parameter_overrides = [
    "Stage=dev",
    "CognitoUserPoolId=us-east-1_XXXXXXXXX"  # Tu User Pool ID aquí
]
```

### 5. Crear App Client en Cognito

Necesitas crear un App Client en tu User Pool:

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id YOUR_USER_POOL_ID \
  --client-name winking-owl-app-client \
  --generate-secret false \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH
```

**Guarda el Client ID** - lo necesitarás en la app móvil.

## Verificar Instalación

### Ejecutar Tests

```bash
npm test
```

Deberías ver todos los tests pasando ✅

### Build Local

```bash
npm run build
```

## Próximos Pasos

1. **Desplegar a AWS**:
   ```bash
   npm run deploy:dev
   ```

2. **Obtener URL de la API**:
   - Al final del deployment, verás la URL en los Outputs
   - O busca en CloudFormation → Stack → Outputs

3. **Configurar en App Móvil**:
   - Actualiza la URL de la API en la app móvil
   - Configura el Cognito Client ID

## Troubleshooting

### Error: "SAM CLI not found"
```bash
# macOS
brew install aws-sam-cli

# Verificar instalación
sam --version
```

### Error: "CognitoUserPoolId not found"
- Verifica que el User Pool ID esté correcto en `samconfig.toml`
- Verifica que el User Pool exista en la región correcta

### Error: "Unauthorized" al probar endpoints
- Verifica que el token JWT sea válido
- Verifica que el User Pool esté configurado correctamente en `template.yaml`

## Estructura del Proyecto

```
rork-winking-owl-audits-api/
├── functions/          # Lambda functions
├── shared/            # Código compartido
├── template.yaml      # SAM template
├── samconfig.toml     # SAM config
└── package.json
```

## Comandos Útiles

```bash
# Tests
npm test
npm run test:watch
npm run test:coverage

# Linting
npm run lint
npm run lint:fix

# Build & Deploy
npm run build
npm run deploy:dev
npm run deploy:prod

# Local testing
npm run local:start
```

---

¡Listo para empezar! 🚀

