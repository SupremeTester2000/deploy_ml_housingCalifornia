# California Housing ML — frontend

Aplicación Angular standalone para predecir valores de viviendas con FastAPI y solicitar reentrenamientos mediante GitHub Actions.

## Desarrollo local

Requiere Node.js 20.19+, 22.12+ o 24+ (versión recomendada en `.node-version`) y npm. Angular 20 no arranca con el Node 20.11 anterior.

```bash
nvm install 20.19.0
nvm use 20.19.0
cd frontend
npm ci
API_BASE_URL=http://127.0.0.1:8001 npm start
```

Abre `http://localhost:4200`. El hook `prestart` genera `public/runtime-config.js` antes de Angular, usando `API_BASE_URL`; no reutilices una instancia antigua de `ng serve` después de cambiar Node, puerto o URL.

En otra terminal, desde la raíz del repositorio, inicia FastAPI en el puerto indicado:

```bash
source .venv/bin/activate
FRONTEND_ORIGINS=http://localhost:4200,http://127.0.0.1:4200 \
  python -u -m uvicorn app:app --host 127.0.0.1 --port 8001 --log-level debug
```

En desarrollo, CORS permite ambos hostnames comunes para Angular. Si usas otro host o puerto, inclúyelo exactamente en `FRONTEND_ORIGINS`; reinicia FastAPI para aplicar el cambio.

La predicción requiere que `model/model.joblib` exista. Para reentrenar, configura además las variables del backend indicadas abajo y proporciona en la sección **Administración del modelo** la credencial de operador (`RETRAIN_API_TOKEN`). La credencial se envía al backend por HTTPS y no se guarda en el navegador.

## Variables de entorno del backend

Configúralas en el entorno del servidor FastAPI (por ejemplo, en Render), nunca en Angular:

| Variable | Propósito |
| --- | --- |
| `FRONTEND_ORIGINS` | Orígenes exactos separados por coma, por ejemplo `https://mi-frontend.onrender.com`. En desarrollo incluye `http://localhost:4200,http://127.0.0.1:4200`. |
| `RETRAIN_API_TOKEN` | Secreto aleatorio de al menos 32 caracteres exigido por `POST /retrain`; puedes generarlo con `openssl rand -hex 32` y entregarlo solo a operadores autorizados. |
| `GITHUB_TOKEN` | Token de GitHub con permiso `Contents: Read and write` únicamente sobre este repositorio, para emitir `repository_dispatch`. |
| `GITHUB_REPOSITORY` | Repositorio destino en formato `propietario/repositorio`; por defecto `SupremeTester2000/deploy_ml_housingCalifornia`. |
| `CLOUDINARY_DATASET_25_URL` | URL HTTPS del CSV del 25 % alojado en `res.cloudinary.com/doexahadj`. |
| `CLOUDINARY_DATASET_50_URL` | URL HTTPS del CSV del 50 % alojado en `res.cloudinary.com/doexahadj`. |
| `CLOUDINARY_DATASET_100_URL` | URL HTTPS del CSV completo alojado en `res.cloudinary.com/doexahadj`. |

El endpoint valida la credencial de operador y el porcentaje permitido antes de llamar a GitHub. El token de GitHub y las URLs Cloudinary nunca se envían al navegador.

## Compilación y despliegue en Render

Crear un **Static Site** con raíz del repositorio como *Root Directory*:

- **Build Command:** `cd frontend && npm ci && npm run build`
- **Publish Directory:** `frontend/dist/frontend/browser`
- **Build environment variables:** `NODE_VERSION=20.19.0` y `API_BASE_URL=https://<url-publica-del-backend>`

`npm run build` genera `public/runtime-config.js` durante la compilación, usando `API_BASE_URL`; no incrusta credenciales. Si aún no tienes un backend público, deja la variable sin configurar y añádela al crear el servicio. El archivo `public/_redirects` configura la reescritura SPA de Render.

En el servicio del backend configura `FRONTEND_ORIGINS` con el origen público exacto del Static Site, junto con los secretos y URLs Cloudinary. CORS limita los orígenes del navegador, pero no sustituye la autenticación del endpoint de reentrenamiento.

La predicción y el indicador de conexión dependen de que la API FastAPI esté desplegada y accesible. El reentrenamiento también requiere sus variables del servidor y una credencial de operador; la respuesta confirma que GitHub aceptó la solicitud, no que el entrenamiento haya finalizado. El estado de la ejecución se consulta en [GitHub Actions](https://github.com/SupremeTester2000/deploy_ml_housingCalifornia/actions).
