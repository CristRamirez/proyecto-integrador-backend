# Proyecto Integrador — Backend (API REST)

API REST en Node.js + Express. La base de datos es **D1 (SQLite) de Cloudflare**, a la
que se accede por su API HTTP.

## Cómo levantarlo

1. Instalar las dependencias:

   ```
   npm install
   ```

2. Copiar `.env.example` a `.env` y completar los valores:

   - `CF_D1_API_TOKEN`: token de Cloudflare con permiso *Account > D1 > Edit*.
   - `JWT_SECRET`: cualquier texto largo y secreto. Se puede generar con
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

   El archivo `.env` **no se sube al repo** (está en el `.gitignore`).

3. Crear las tablas en D1 (una sola vez) con los scripts de la carpeta `db/`:
   `db/schema.sql` y, para tener un usuario de prueba, `db/seed_admin.sql`.

4. Arrancar la API:

   ```
   npm run dev      # con recarga automática (nodemon)
   npm start        # modo normal
   ```

   Queda escuchando en `http://localhost:3000`.

## Deploy en Cloudflare Workers

La misma app de Express corre en Workers gracias al flag `nodejs_compat`:
`src/worker.mjs` la engancha al runtime con `httpServerHandler` y el resto de la
configuración está en `wrangler.jsonc`.

Ahí la base **no** se consulta por la API HTTP: entra como *binding* (`env.DB`),
así que el Worker no necesita ningún token de D1. Corriendo con node no hay
binding y se sigue usando la API HTTP con las variables del `.env`.

1. Cargar el único secreto (una sola vez por Worker):

   ```
   npx wrangler secret put JWT_SECRET
   ```

   Con `nodejs_compat` las vars y los secrets del Worker llegan a `process.env`,
   así que `src/config/env.js` los lee igual que en local.

2. Publicar:

   ```
   npm run deploy
   ```

Si el deploy se hace desde el panel conectando el repo, los campos son: **build
command** vacío (el proyecto no se compila) y **deploy command** `npx wrangler deploy`.

Para probarlo local antes de publicar: `npm run dev:worker`, que lee los secretos
de un archivo `.dev.vars` (mismo formato que `.env`, tampoco se sube al repo).

## Estructura de carpetas

```
src/
├── server.js            arranca el servidor en Node (local)
├── worker.mjs           punto de entrada en Cloudflare Workers
├── app.js               arma la app de Express (middlewares + rutas)
├── config/env.js        lee y valida las variables de entorno
├── db/d1.js             cliente de la base D1 (consultas por HTTP)
├── routes/              qué URL responde cada módulo
├── controllers/         qué hace cada ruta (recibe el pedido y arma la respuesta)
├── services/            consultas a la base, reutilizables entre controladores
├── middlewares/         autenticación, control por rol y manejo de errores
└── utils/               ApiError, firma de tokens y asyncHandler
```

Para agregar un módulo nuevo (internos, cobranzas, etc.) se crean su `*.routes.js`,
su `*.controller.js` y su `*.service.js`, y se monta el router en `src/routes/index.js`.

## Endpoints disponibles

| Método | Ruta                      | Acceso                | Para qué sirve                                 |
|--------|---------------------------|-----------------------|------------------------------------------------|
| GET    | `/api/salud`              | público               | Ver si la API está viva (`?db=1` prueba la base)|
| POST   | `/api/auth/login`         | público               | Devuelve el token de sesión                     |
| GET    | `/api/auth/yo`            | con token             | Datos del usuario dueño del token               |
| GET    | `/api/ejemplo/publico`    | público               | Ruta de ejemplo sin protección                  |
| GET    | `/api/ejemplo/protegido`  | con token             | Ruta de ejemplo que exige token                 |
| GET    | `/api/ejemplo/solo-admin` | rol `administrador`   | Ruta de ejemplo con control por rol             |
| GET    | `/api/ejemplo/error`      | público               | Falla a propósito, para ver el manejo de errores|

Las rutas de `/api/ejemplo` son solo de muestra: quedan como molde de los tres casos
(abierta, con token y con rol) y se borran cuando estén los módulos reales.

### Login

```
POST /api/auth/login
Content-Type: application/json

{ "nombre_usuario": "admin", "password": "admin1234" }
```

Respuesta:

```json
{
  "ok": true,
  "token": "eyJhbGciOi...",
  "usuario": { "id": 1, "nombreUsuario": "admin", "nombreCompleto": "Administrador de prueba", "rol": "administrador" }
}
```

El token se manda en el resto de los pedidos en el encabezado:

```
Authorization: Bearer eyJhbGciOi...
```

> El login de acá es el mínimo para poder probar la API y que la app de escritorio
> tenga contra qué autenticarse. Las reglas completas (bloqueo a los 5 intentos
> fallidos, los cuatro roles del enunciado) son de la tarjeta **BS-1**.

## Formato de las respuestas de error

Todos los errores salen por el mismo lugar y con la misma forma:

```json
{ "ok": false, "error": { "codigo": "TOKEN_FALTANTE", "mensaje": "Falta el token de acceso" } }
```

| Código HTTP | Cuándo aparece                                      |
|-------------|-----------------------------------------------------|
| 400         | Faltan datos o el JSON del cuerpo está mal armado   |
| 401         | No hay token, el token es inválido o venció; login incorrecto |
| 403         | El rol del usuario no tiene permiso para esa ruta   |
| 404         | La ruta no existe                                   |
| 500         | Error no previsto (bug): el detalle queda en el log |
| 502 / 503   | Falló la consulta a D1 o no se pudo conectar        |

## Cómo proteger una ruta nueva

```js
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const { requiereRol } = require('../middlewares/autorizacion');

router.get('/solo-logueados', requiereAutenticacion, controlador);
router.post('/altas', requiereAutenticacion, requiereRol('administrador'), controlador);
router.get('/cuotas', requiereAutenticacion, requiereRol('administrador', 'contador'), controlador);
```
