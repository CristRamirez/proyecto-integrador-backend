const { desc, eq, sql } = require('drizzle-orm');
const { alias } = require('drizzle-orm/sqlite-core');
const { db } = require('../db/d1');
const { notas, usuarios } = require('../db/schema');

const modificadores = alias(usuarios, 'modificadores');

const COLUMNAS = {
  id: notas.id,
  interno_id: notas.interno_id,
  texto: notas.texto,
  creado_en: notas.creado_en,
  escrita_por: usuarios.nombre_completo,
  modificado_en: notas.modificado_en,
  modificada_por: modificadores.nombre_completo,
};

function conUsuarios(consulta) {
  return consulta
    .leftJoin(usuarios, eq(usuarios.id, notas.usuario_id))
    .leftJoin(modificadores, eq(modificadores.id, notas.modificado_por));
}

async function listarPorInterno(internoId) {
  return conUsuarios(db().select(COLUMNAS).from(notas))
    .where(eq(notas.interno_id, internoId))
    .orderBy(desc(notas.creado_en), desc(notas.id));
}

async function obtener(notaId) {
  const [fila] = await conUsuarios(db().select(COLUMNAS).from(notas))
    .where(eq(notas.id, notaId))
    .limit(1);

  return fila || null;
}

async function crear(internoId, texto, usuarioId) {
  const [fila] = await db()
    .insert(notas)
    .values({ interno_id: internoId, texto, usuario_id: usuarioId ?? null })
    .returning({ id: notas.id });

  return fila.id;
}

async function actualizar(notaId, texto, usuarioId) {
  await db()
    .update(notas)
    .set({ texto, modificado_por: usuarioId ?? null, modificado_en: sql`(datetime('now'))` })
    .where(eq(notas.id, notaId));
}

async function eliminar(notaId) {
  await db().delete(notas).where(eq(notas.id, notaId));
}

module.exports = { listarPorInterno, obtener, crear, actualizar, eliminar };
