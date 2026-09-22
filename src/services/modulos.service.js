const { asc, eq } = require('drizzle-orm');
const { db } = require('../db/d1');
const { modulos, rolModulo } = require('../db/schema');

async function listar() {
  return db().select().from(modulos).orderBy(asc(modulos.nombre));
}

async function obtenerPorId(id) {
  const [fila] = await db().select().from(modulos).where(eq(modulos.id, id)).limit(1);

  return fila || null;
}

async function buscarPorNombre(nombre) {
  const [fila] = await db().select().from(modulos).where(eq(modulos.nombre, nombre)).limit(1);

  return fila || null;
}

async function crear(nombre) {
  const [fila] = await db()
    .insert(modulos)
    .values({ nombre })
    .returning({ id: modulos.id, nombre: modulos.nombre });

  return fila || null;
}

async function actualizar(id, nombre) {
  const [fila] = await db()
    .update(modulos)
    .set({ nombre })
    .where(eq(modulos.id, id))
    .returning({ id: modulos.id, nombre: modulos.nombre });

  return fila || null;
}

async function eliminar(id) {
  await db().delete(modulos).where(eq(modulos.id, id));
}

// Un módulo asignado a algún rol no se puede borrar: primero hay que sacárselo.
async function estaAsignado(id) {
  const [fila] = await db()
    .select({ rol_id: rolModulo.rol_id })
    .from(rolModulo)
    .where(eq(rolModulo.modulo_id, id))
    .limit(1);

  return Boolean(fila);
}

module.exports = {
  listar,
  obtenerPorId,
  buscarPorNombre,
  crear,
  actualizar,
  eliminar,
  estaAsignado,
};
