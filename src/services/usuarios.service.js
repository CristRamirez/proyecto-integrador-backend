const { and, asc, count, eq, or, sql } = require('drizzle-orm');
const { db } = require('../db/d1');
const { usuarios, roles } = require('../db/schema');
const { contiene } = require('../utils/busqueda');

// Acá viven las consultas a la tabla usuarios. Los controladores no arman
// consultas: piden los datos por acá, así una misma consulta se reutiliza
// desde varios lados.

const ROL_ADMINISTRADOR = 'administrador';

const COLUMNAS = {
  id: usuarios.id,
  nombre_usuario: usuarios.nombre_usuario,
  nombre_completo: usuarios.nombre_completo,
  email: usuarios.email,
  rol_id: usuarios.rol_id,
  rol: roles.nombre,
  activo: usuarios.activo,
  bloqueado_hasta: usuarios.bloqueado_hasta,
  creado_en: usuarios.creado_en,
};

// Busca el usuario por su nombre de usuario y trae también el nombre del rol
// (en la tabla usuarios solo está guardado el rol_id).
async function buscarPorNombreUsuario(nombreUsuario) {
  const [fila] = await db()
    .select({
      id: usuarios.id,
      nombre_usuario: usuarios.nombre_usuario,
      nombre_completo: usuarios.nombre_completo,
      email: usuarios.email,
      password_hash: usuarios.password_hash,
      activo: usuarios.activo,
      intentos_fallidos: usuarios.intentos_fallidos,
      bloqueado_hasta: usuarios.bloqueado_hasta,
      rol: roles.nombre,
    })
    .from(usuarios)
    .innerJoin(roles, eq(roles.id, usuarios.rol_id))
    .where(sql`lower(${usuarios.nombre_usuario}) = ${String(nombreUsuario).toLowerCase()}`)
    .limit(1);

  return fila || null;
}

async function actualizarIntentos(id, intentos, bloqueadoHasta) {
  await db()
    .update(usuarios)
    .set({ intentos_fallidos: intentos, bloqueado_hasta: bloqueadoHasta })
    .where(eq(usuarios.id, id));
}

async function reiniciarIntentos(id) {
  await actualizarIntentos(id, 0, null);
}

function estaBloqueado(usuario) {
  const ahora = new Date().toISOString().slice(0, 19).replace('T', ' ');

  return Boolean(usuario.bloqueado_hasta) && usuario.bloqueado_hasta > ahora;
}

function filtro({ texto, rolId, activo }) {
  const partes = [];

  if (texto) {
    partes.push(
      or(
        contiene(usuarios.nombre_usuario, texto),
        contiene(usuarios.nombre_completo, texto),
        contiene(usuarios.email, texto)
      )
    );
  }

  if (rolId) {
    partes.push(eq(usuarios.rol_id, rolId));
  }

  if (activo !== null && activo !== undefined) {
    partes.push(eq(usuarios.activo, activo ? 1 : 0));
  }

  return partes.length ? and(...partes) : undefined;
}

async function listar(filtros) {
  const condicion = filtro(filtros);

  const [conteo] = await db().select({ total: count() }).from(usuarios).where(condicion);

  const filas = await db()
    .select(COLUMNAS)
    .from(usuarios)
    .innerJoin(roles, eq(roles.id, usuarios.rol_id))
    .where(condicion)
    .orderBy(asc(usuarios.nombre_usuario))
    .limit(filtros.porPagina)
    .offset((filtros.pagina - 1) * filtros.porPagina);

  return { usuarios: filas, total: conteo ? conteo.total : 0 };
}

async function obtener(id) {
  const [fila] = await db()
    .select(COLUMNAS)
    .from(usuarios)
    .innerJoin(roles, eq(roles.id, usuarios.rol_id))
    .where(eq(usuarios.id, id))
    .limit(1);

  return fila || null;
}

async function buscarPorEmail(email) {
  const [fila] = await db()
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(sql`lower(${usuarios.email}) = ${email.toLowerCase()}`)
    .limit(1);

  return fila || null;
}

async function crear(datos) {
  const [fila] = await db()
    .insert(usuarios)
    .values({
      nombre_usuario: datos.nombreUsuario,
      nombre_completo: datos.nombreCompleto,
      email: datos.email,
      password_hash: datos.passwordHash,
      rol_id: datos.rolId,
    })
    .returning({ id: usuarios.id });

  return fila.id;
}

async function actualizar(id, datos) {
  await db()
    .update(usuarios)
    .set({
      nombre_usuario: datos.nombreUsuario,
      nombre_completo: datos.nombreCompleto,
      email: datos.email,
      rol_id: datos.rolId,
    })
    .where(eq(usuarios.id, id));
}

async function cambiarPassword(id, passwordHash) {
  await db()
    .update(usuarios)
    .set({ password_hash: passwordHash, intentos_fallidos: 0, bloqueado_hasta: null })
    .where(eq(usuarios.id, id));
}

async function cambiarActivo(id, activo) {
  await db()
    .update(usuarios)
    .set({ activo: activo ? 1 : 0 })
    .where(eq(usuarios.id, id));
}

async function contarAdministradoresActivos() {
  const [fila] = await db()
    .select({ total: count() })
    .from(usuarios)
    .innerJoin(roles, eq(roles.id, usuarios.rol_id))
    .where(and(eq(usuarios.activo, 1), eq(roles.nombre, ROL_ADMINISTRADOR)));

  return fila ? fila.total : 0;
}

module.exports = {
  ROL_ADMINISTRADOR,
  buscarPorNombreUsuario,
  actualizarIntentos,
  reiniciarIntentos,
  estaBloqueado,
  listar,
  obtener,
  buscarPorEmail,
  crear,
  actualizar,
  cambiarPassword,
  cambiarActivo,
  contarAdministradoresActivos,
};
