// Crea usuarios para poder entrar por POST /api/auth/login.
//
// Uso:
//   node scripts/crear-usuario.js --usuario juan --password Secreta123 --rol empleado
//   node scripts/crear-usuario.js --usuario juan --password Secreta123 --rol empleado --nombre "Juan Perez" --email juan@proyecto.local
//   node scripts/crear-usuario.js --usuario juan --password Secreta123 --rol empleado --sql
//   node scripts/crear-usuario.js --listar
//
// Sin --sql escribe directo en D1 (necesita CF_D1_API_TOKEN cargado en .env).
// Con --sql no toca la base: imprime el INSERT ya armado para pegar en la
// consola de D1 del panel de Cloudflare.

const bcrypt = require('bcryptjs');

const COSTO_BCRYPT = 10;        // mismo costo que el hash de db/seed_admin.sql
const LARGO_MINIMO_CLAVE = 8;

// Parser mínimo de  --clave valor  y banderas sueltas (--sql, --listar).
function leerArgumentos(argv) {
  const opciones = {};

  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;

    const clave = argv[i].slice(2);
    const siguiente = argv[i + 1];

    if (siguiente === undefined || siguiente.startsWith('--')) {
      opciones[clave] = true;
    } else {
      opciones[clave] = siguiente;
      i++;
    }
  }

  return opciones;
}

function terminarConError(mensaje) {
  console.error(`\nError: ${mensaje}\n`);
  process.exit(1);
}

// Escapa comillas simples para poder incrustar el valor en el SQL de --sql.
// En el modo que escribe en D1 no hace falta: ahí las consultas van parametrizadas.
function comillas(valor) {
  if (valor === null || valor === undefined || valor === '') return 'NULL';
  return `'${String(valor).replace(/'/g, "''")}'`;
}

function mostrarAyuda() {
  console.log(`
Crea un usuario para el login de la API.

  --usuario   <texto>   nombre con el que se inicia sesion   (obligatorio)
  --password  <texto>   contrasena en claro, minimo ${LARGO_MINIMO_CLAVE}       (obligatorio)
  --rol       <texto>   rol del usuario                      (obligatorio)
  --nombre    <texto>   nombre completo para mostrar         (opcional)
  --email     <texto>   correo                               (opcional)
  --sql                 no toca la base: imprime el INSERT
  --listar              muestra los usuarios y roles ya cargados

Ejemplo:
  node scripts/crear-usuario.js --usuario juan --password Secreta123 --rol empleado
`);
}

// Lista lo que ya hay en la base. Sirve para ver contra que usuarios se puede
// probar el login sin tener que abrir el panel de Cloudflare.
async function listar() {
  const { asc, eq } = require('drizzle-orm');
  const { db } = require('../src/db/d1');
  const tablas = require('../src/db/schema');

  const roles = await db().select().from(tablas.roles).orderBy(asc(tablas.roles.id));
  console.log('\nRoles:');
  roles.forEach((r) => console.log(`  ${r.id}  ${r.nombre}`));

  const usuarios = await db()
    .select({
      id: tablas.usuarios.id,
      nombre_usuario: tablas.usuarios.nombre_usuario,
      activo: tablas.usuarios.activo,
      rol: tablas.roles.nombre,
    })
    .from(tablas.usuarios)
    .innerJoin(tablas.roles, eq(tablas.roles.id, tablas.usuarios.rol_id))
    .orderBy(asc(tablas.usuarios.id));

  console.log('\nUsuarios:');
  if (usuarios.length === 0) {
    console.log('  (todavia no hay ninguno)');
  } else {
    usuarios.forEach((u) =>
      console.log(`  ${u.id}  ${u.nombre_usuario}  [${u.rol}]${u.activo ? '' : '  INACTIVO'}`)
    );
  }
  console.log('');
}

// Inserta el usuario en D1. Antes chequea que el rol exista y que el nombre de
// usuario este libre, para dar un mensaje claro en vez del error de la base.
async function insertarEnD1(datos) {
  const { asc, eq } = require('drizzle-orm');
  const { db } = require('../src/db/d1');
  const tablas = require('../src/db/schema');

  const [rol] = await db()
    .select()
    .from(tablas.roles)
    .where(eq(tablas.roles.nombre, datos.rol))
    .limit(1);

  if (!rol) {
    const roles = await db().select().from(tablas.roles).orderBy(asc(tablas.roles.id));
    terminarConError(
      `el rol "${datos.rol}" no existe. Roles disponibles: ${roles.map((r) => r.nombre).join(', ')}`
    );
  }

  const [existente] = await db()
    .select({ id: tablas.usuarios.id })
    .from(tablas.usuarios)
    .where(eq(tablas.usuarios.nombre_usuario, datos.usuario))
    .limit(1);

  if (existente) {
    terminarConError(`el usuario "${datos.usuario}" ya existe (id ${existente.id})`);
  }

  const [creado] = await db()
    .insert(tablas.usuarios)
    .values({
      nombre_usuario: datos.usuario,
      nombre_completo: datos.nombre,
      email: datos.email,
      password_hash: datos.hash,
      rol_id: rol.id,
    })
    .returning({ id: tablas.usuarios.id, nombre_usuario: tablas.usuarios.nombre_usuario });

  console.log(`\nUsuario creado: id ${creado.id}  ${creado.nombre_usuario}  [${datos.rol}]`);
  console.log('\nProbalo con:');
  console.log(`  curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"nombre_usuario":"${datos.usuario}","password":"<la clave que pusiste>"}'`);
  console.log('');
}

// El rol se resuelve con una subconsulta para no tener que averiguar el id a mano.
function imprimirSql(datos) {
  console.log(`
-- Pegar en la consola de D1 (panel de Cloudflare > D1 > la base > Console).
-- Clave en claro: ${datos.password}
INSERT INTO usuarios (nombre_usuario, nombre_completo, email, password_hash, rol_id)
VALUES (
  ${comillas(datos.usuario)},
  ${comillas(datos.nombre)},
  ${comillas(datos.email)},
  ${comillas(datos.hash)},
  (SELECT id FROM roles WHERE nombre = ${comillas(datos.rol)})
);
`);
}

async function principal() {
  const opciones = leerArgumentos(process.argv.slice(2));

  if (opciones.ayuda || opciones.help || process.argv.length === 2) {
    mostrarAyuda();
    return;
  }

  if (opciones.listar) {
    await listar();
    return;
  }

  const usuario = opciones.usuario;
  const password = opciones.password;
  const rol = opciones.rol;

  if (typeof usuario !== 'string' || typeof password !== 'string' || typeof rol !== 'string') {
    mostrarAyuda();
    terminarConError('faltan --usuario, --password y/o --rol');
  }

  if (password.length < LARGO_MINIMO_CLAVE) {
    terminarConError(`la contrasena tiene que tener al menos ${LARGO_MINIMO_CLAVE} caracteres`);
  }

  const datos = {
    usuario,
    password,
    rol,
    nombre: typeof opciones.nombre === 'string' ? opciones.nombre : null,
    email: typeof opciones.email === 'string' ? opciones.email : null,
    // La contrasena nunca se guarda en claro: va el hash de bcrypt.
    hash: await bcrypt.hash(password, COSTO_BCRYPT),
  };

  if (opciones.sql) {
    imprimirSql(datos);
    return;
  }

  await insertarEnD1(datos);
}

principal().catch((error) => {
  // Los errores del cliente de D1 vienen como ApiError, con el detalle aparte.
  terminarConError(error.detalle ? `${error.message} (${error.detalle})` : error.message);
});
