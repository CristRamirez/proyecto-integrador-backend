const { and, asc, desc, eq, isNotNull, isNull, like, sql } = require('drizzle-orm');
const { db } = require('../db/d1');
const { legajos } = require('../db/schema');

const COLUMNAS = {
  id: legajos.id,
  numero: legajos.numero,
  fecha_apertura: legajos.fecha_apertura,
  fecha_ingreso: legajos.fecha_ingreso,
  fecha_egreso: legajos.fecha_egreso,
  motivo_egreso: legajos.motivo_egreso,
};

// Arma el número de legajo del día con el formato LEG-AAAAMMDD-NNNN (RN8).
// NNNN es el correlativo dentro de ese día: se busca el último usado y se le
// suma uno. substr(numero, 14) es la parte NNNN del número ya guardado.
async function generarNumero(fecha = new Date()) {
  const dia = fecha.toISOString().slice(0, 10).replace(/-/g, '');

  const [fila] = await db()
    .select({ ultimo: sql`MAX(CAST(substr(${legajos.numero}, 14) AS INTEGER))`.mapWith(Number) })
    .from(legajos)
    .where(like(legajos.numero, `LEG-${dia}-%`));

  const siguiente = ((fila && fila.ultimo) || 0) + 1;

  return `LEG-${dia}-${String(siguiente).padStart(4, '0')}`;
}

// fecha_apertura no se manda: la pone la base con su valor por defecto.
async function crear(internoId, numero, fechaIngreso = null) {
  const [fila] = await db()
    .insert(legajos)
    .values({ interno_id: internoId, numero, fecha_ingreso: fechaIngreso })
    .returning(COLUMNAS);

  return fila || null;
}

async function listarPorInterno(internoId) {
  return db()
    .select(COLUMNAS)
    .from(legajos)
    .where(eq(legajos.interno_id, internoId))
    .orderBy(asc(legajos.id));
}

async function cerrarAbierto(internoId, fechaEgreso, motivoEgreso) {
  await db()
    .update(legajos)
    .set({ fecha_egreso: fechaEgreso, motivo_egreso: motivoEgreso })
    .where(and(eq(legajos.interno_id, internoId), isNull(legajos.fecha_egreso)));
}

async function ultimoEgreso(internoId) {
  const [fila] = await db()
    .select({ fecha_egreso: legajos.fecha_egreso })
    .from(legajos)
    .where(and(eq(legajos.interno_id, internoId), isNotNull(legajos.fecha_egreso)))
    .orderBy(desc(legajos.id))
    .limit(1);

  return fila ? fila.fecha_egreso : null;
}

module.exports = { generarNumero, crear, listarPorInterno, cerrarAbierto, ultimoEgreso };
