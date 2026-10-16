const { desc, eq } = require('drizzle-orm');
const { db } = require('../db/d1');
const { configuracionCuotas, usuarios } = require('../db/schema');

const COLUMNAS = {
  id: configuracionCuotas.id,
  valor_cuota: configuracionCuotas.valor_cuota,
  valor_mora: configuracionCuotas.valor_mora,
  dia_vencimiento: configuracionCuotas.dia_vencimiento,
  es_actual: configuracionCuotas.es_actual,
  observaciones: configuracionCuotas.observaciones,
  creado_en: configuracionCuotas.creado_en,
  definido_por: usuarios.nombre_completo,
};

async function obtenerVigente() {
  const [fila] = await db()
    .select(COLUMNAS)
    .from(configuracionCuotas)
    .leftJoin(usuarios, eq(usuarios.id, configuracionCuotas.usuario_id))
    .where(eq(configuracionCuotas.es_actual, 1))
    .limit(1);

  return fila || null;
}

async function listarHistorico() {
  return db()
    .select(COLUMNAS)
    .from(configuracionCuotas)
    .leftJoin(usuarios, eq(usuarios.id, configuracionCuotas.usuario_id))
    .orderBy(desc(configuracionCuotas.creado_en), desc(configuracionCuotas.id));
}

async function guardar(datos, usuarioId) {
  await db()
    .update(configuracionCuotas)
    .set({ es_actual: 0 })
    .where(eq(configuracionCuotas.es_actual, 1));

  await db()
    .insert(configuracionCuotas)
    .values({
      valor_cuota: datos.valorCuota,
      valor_mora: datos.valorMora,
      dia_vencimiento: datos.diaVencimiento,
      es_actual: 1,
      observaciones: datos.observaciones ?? null,
      usuario_id: usuarioId ?? null,
    });

  return obtenerVigente();
}

module.exports = { obtenerVigente, listarHistorico, guardar };
