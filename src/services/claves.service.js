const { asc, eq, sql } = require('drizzle-orm');
const { alias } = require('drizzle-orm/sqlite-core');
const { db } = require('../db/d1');
const { clavesIntegracion, usuarios } = require('../db/schema');

const modificadores = alias(usuarios, 'modificadores_claves');

const COLUMNAS = {
  id: clavesIntegracion.id,
  servicio: clavesIntegracion.servicio,
  descripcion: clavesIntegracion.descripcion,
  termina_en: sql`substr(${clavesIntegracion.valor}, -4)`,
  activo: clavesIntegracion.activo,
  creado_en: clavesIntegracion.creado_en,
  cargada_por: usuarios.nombre_completo,
  modificado_en: clavesIntegracion.modificado_en,
  modificada_por: modificadores.nombre_completo,
};

function conUsuarios(consulta) {
  return consulta
    .leftJoin(usuarios, eq(usuarios.id, clavesIntegracion.usuario_id))
    .leftJoin(modificadores, eq(modificadores.id, clavesIntegracion.modificado_por));
}

async function listar() {
  return conUsuarios(db().select(COLUMNAS).from(clavesIntegracion)).orderBy(asc(clavesIntegracion.servicio));
}

async function obtener(claveId) {
  const [fila] = await conUsuarios(db().select(COLUMNAS).from(clavesIntegracion))
    .where(eq(clavesIntegracion.id, claveId))
    .limit(1);

  return fila || null;
}

async function buscarPorServicio(servicio) {
  const [fila] = await db()
    .select({ id: clavesIntegracion.id })
    .from(clavesIntegracion)
    .where(sql`lower(${clavesIntegracion.servicio}) = ${servicio.toLowerCase()}`)
    .limit(1);

  return fila || null;
}

async function crear(datos) {
  const [fila] = await db()
    .insert(clavesIntegracion)
    .values({
      servicio: datos.servicio,
      descripcion: datos.descripcion,
      valor: datos.valor,
      usuario_id: datos.usuarioId ?? null,
    })
    .returning({ id: clavesIntegracion.id });

  return fila.id;
}

async function actualizar(claveId, datos, usuarioId) {
  await db()
    .update(clavesIntegracion)
    .set({
      servicio: datos.servicio,
      descripcion: datos.descripcion,
      ...(datos.valor ? { valor: datos.valor } : {}),
      modificado_por: usuarioId ?? null,
      modificado_en: sql`(datetime('now'))`,
    })
    .where(eq(clavesIntegracion.id, claveId));
}

async function cambiarActivo(claveId, activo, usuarioId) {
  await db()
    .update(clavesIntegracion)
    .set({
      activo: activo ? 1 : 0,
      modificado_por: usuarioId ?? null,
      modificado_en: sql`(datetime('now'))`,
    })
    .where(eq(clavesIntegracion.id, claveId));
}

async function eliminar(claveId) {
  await db().delete(clavesIntegracion).where(eq(clavesIntegracion.id, claveId));
}

module.exports = { listar, obtener, buscarPorServicio, crear, actualizar, cambiarActivo, eliminar };
