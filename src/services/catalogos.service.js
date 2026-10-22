const { asc, eq } = require('drizzle-orm');
const { db } = require('../db/d1');
const { estados, mediosPago, obrasSociales } = require('../db/schema');

// Catálogos: tablas chicas que solo se leen, para llenar los desplegables
// del formulario de alta (estado y obra social).

async function listarEstados() {
  return db().select().from(estados).orderBy(asc(estados.nombre));
}

async function listarObrasSociales() {
  return db().select().from(obrasSociales).orderBy(asc(obrasSociales.nombre));
}

async function buscarMedioPago(medioPagoId) {
  const [fila] = await db()
    .select({ id: mediosPago.id, nombre: mediosPago.nombre })
    .from(mediosPago)
    .where(eq(mediosPago.id, medioPagoId))
    .limit(1);

  return fila || null;
}

async function listarMediosPago() {
  return db().select().from(mediosPago).orderBy(asc(mediosPago.nombre));
}

// La usa el alta para saber con qué estado_id nace un interno ('activo').
async function buscarEstadoPorNombre(nombre) {
  const [fila] = await db().select().from(estados).where(eq(estados.nombre, nombre)).limit(1);

  return fila || null;
}

module.exports = {
  listarEstados,
  listarObrasSociales,
  listarMediosPago,
  buscarMedioPago,
  buscarEstadoPorNombre,
};
