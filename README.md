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
| GET    | `/api/modulos`            | rol `administrador`   | Módulos del sistema                             |
| POST   | `/api/modulos`            | rol `administrador`   | Alta de módulo                                  |
| PUT    | `/api/modulos/:id`        | rol `administrador`   | Renombra un módulo                              |
| DELETE | `/api/modulos/:id`        | rol `administrador`   | Borra un módulo que no esté asignado a un rol   |
| GET    | `/api/roles`              | rol `administrador`   | Roles con su cantidad de módulos                |
| GET    | `/api/roles/:id/modulos`  | rol `administrador`   | Módulos a los que accede ese rol                |
| PUT    | `/api/roles/:id/modulos`  | rol `administrador`   | Reemplaza los módulos del rol: `{"modulos":[1,3]}`|
| GET    | `/api/estados`            | con token             | Catálogo de estados del interno                 |
| GET    | `/api/obras-sociales`     | con token             | Catálogo de obras sociales                      |
| POST   | `/api/internos`           | módulo `internos`     | Alta de interno (BS-2)                          |

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

**Bloqueo por intentos fallidos (BS-1).** A los 5 intentos fallidos seguidos el usuario
queda bloqueado 5 minutos: mientras dura, el login responde 423 `USUARIO_BLOQUEADO` aunque
la contraseña sea la correcta. El contador se guarda en `usuarios.intentos_fallidos` y la
fecha de desbloqueo en `usuarios.bloqueado_hasta`. Un login correcto lo vuelve a cero, y
cuando el bloqueo se vence el conteo arranca de nuevo.

Roles en la base: `administrador`, `empleado`, `operador`, `contador` y `solo lectura`.
A qué módulos accede cada uno se define desde el ABM (`PUT /api/roles/:id/modulos`): los
roles nuevos arrancan sin módulos, así que su menú viene vacío hasta que se los asignen.

### Alta de interno (BS-2)

```
POST /api/internos
Authorization: Bearer <token>
Content-Type: application/json

{
  "dni": "30111222",
  "apellido": "Perez",
  "nombre": "Juan",
  "fecha_nacimiento": "1990-05-12",
  "judicializado": 1,
  "datos_salud": "hipertenso",
  "obra_social_id": 3,
  "fecha_ingreso": "2026-09-22",
  "contactos": [
    { "nombre": "Maria Perez", "parentesco": "madre", "telefono": "1155556666" },
    { "nombre": "Luis Perez", "parentesco": "hermano", "email": "luis@mail.com" }
  ]
}
```

Obligatorios: `dni`, `apellido`, `nombre` y al menos dos contactos, cada uno con nombre y
teléfono o email. `fecha_ingreso` es opcional: si no viene se usa la fecha del día, y una vez
guardada no se modifica. El número de legajo lo genera la API con el formato
`LEG-AAAAMMDD-NNNN` y tampoco se toma del cuerpo del pedido.

Responde 201 con el interno recién creado, su legajo y sus contactos. El alta deja registrado
quién la hizo (`creado_por`) y una primera fila en el historial de estados.

Errores propios del alta:

| Código | Cuándo |
|--------|--------|
| 400 `DATOS_INCOMPLETOS` | falta el DNI, el apellido o el nombre |
| 400 `DNI_INVALIDO` | el DNI no es un número de 7 u 8 dígitos |
| 400 `CONTACTOS_INSUFICIENTES` | vienen menos de dos contactos |
| 400 `CONTACTO_INVALIDO` | un contacto no tiene nombre, o no tiene teléfono ni email |
| 400 `FECHA_INVALIDA` | una fecha no tiene formato AAAA-MM-DD, o el ingreso es futuro |
| 400 `OBRA_SOCIAL_INEXISTENTE` | la obra social indicada no está en el catálogo |
| 409 `DNI_DUPLICADO` | ya hay un **interno activo** con ese DNI |

## Formato de las respuestas de error

Todos los errores salen por el mismo lugar y con la misma forma:

```json
{ "ok": false, "error": { "codigo": "TOKEN_FALTANTE", "mensaje": "Falta el token de acceso" } }
```

| Código HTTP | Cuándo aparece                                      |
|-------------|-----------------------------------------------------|
| 400         | Faltan datos o el JSON del cuerpo está mal armado   |
| 401         | No hay token, el token es inválido o venció; login incorrecto |
| 403         | El rol del usuario no tiene permiso, o no accede a ese módulo |
| 404         | La ruta no existe                                   |
| 423         | El usuario está bloqueado por intentos fallidos     |
| 500         | Error no previsto (bug): el detalle queda en el log |
| 502 / 503   | Falló la consulta a D1 o no se pudo conectar        |

## Cómo proteger una ruta nueva

```js
const { requiereAutenticacion } = require('../middlewares/autenticacion');
const { requiereRol, requiereModulo } = require('../middlewares/autorizacion');

router.get('/solo-logueados', requiereAutenticacion, controlador);
router.post('/altas', requiereAutenticacion, requiereRol('administrador'), controlador);
router.get('/cuotas', requiereAutenticacion, requiereRol('administrador', 'contador'), controlador);
router.get('/internos', requiereAutenticacion, requiereModulo('internos'), controlador);
```
