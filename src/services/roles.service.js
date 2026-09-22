const { and, asc, count, eq, sql } = require('drizzle-orm');
const { db } = require('../db/d1');
const { roles, modulos, rolModulo } = require('../db/schema');

// Se cuentan los módulos de cada rol con leftJoin para que los roles que
// todavía no tienen ninguno también aparezcan, con cantidad 0.
async function listar() {
  return db()
    .select({
      id: roles.id,
      nombre: roles.nombre,
      cantidad_modulos: count(rolModulo.modulo_id),
    })
    .from(roles)
    .leftJoin(rolModulo, eq(rolModulo.rol_id, roles.id))
    .groupBy(roles.id, roles.nombre)
    .orderBy(asc(roles.nombre));
}

async function obtenerPorId(id) {
  const [fila] = await db().select().from(roles).where(eq(roles.id, id)).limit(1);

  return fila || null;
}

async function modulosDeRol(rolId) {
  return db()
    .select({ id: modulos.id, nombre: modulos.nombre })
    .from(rolModulo)
    .innerJoin(modulos, eq(modulos.id, rolModulo.modulo_id))
    .where(eq(rolModulo.rol_id, rolId))
    .orderBy(asc(modulos.nombre));
}

async function nombresDeModulosDelRol(nombreRol) {
  const filas = await db()
    .select({ nombre: modulos.nombre })
    .from(roles)
    .innerJoin(rolModulo, eq(rolModulo.rol_id, roles.id))
    .innerJoin(modulos, eq(modulos.id, rolModulo.modulo_id))
    .where(eq(roles.nombre, nombreRol))
    .orderBy(asc(modulos.nombre));

  return filas.map((fila) => fila.nombre);
}

async function tieneModulo(nombreRol, nombreModulo) {
  const [fila] = await db()
    .select({ permitido: sql`1` })
    .from(roles)
    .innerJoin(rolModulo, eq(rolModulo.rol_id, roles.id))
    .innerJoin(modulos, eq(modulos.id, rolModulo.modulo_id))
    .where(and(eq(roles.nombre, nombreRol), eq(modulos.nombre, nombreModulo)))
    .limit(1);

  return Boolean(fila);
}

async function reemplazarModulos(rolId, modulosIds) {
  await db().delete(rolModulo).where(eq(rolModulo.rol_id, rolId));

  for (const moduloId of modulosIds) {
    await db().insert(rolModulo).values({ rol_id: rolId, modulo_id: moduloId });
  }

  return modulosDeRol(rolId);
}

module.exports = {
  listar,
  obtenerPorId,
  modulosDeRol,
  nombresDeModulosDelRol,
  tieneModulo,
  reemplazarModulos,
};
