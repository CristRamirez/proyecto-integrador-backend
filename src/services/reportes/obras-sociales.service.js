const { and, eq, count, desc, sql } = require('drizzle-orm');
const { db } = require('../../db/d1');
const { mediosPago, obrasSociales, pagos } = require('../../db/schema');
const {
  FORMATOS,
  clave,
  enRango,
  indicador,
  linea,
  mesDe,
  mesesDelRango,
  porcentaje,
  redondear,
  serie,
  suma,
  tarjeta,
  valoresPorMes,
} = require('./comunes');

const MEDIO_OBRA_SOCIAL = 'obra social';
const SIN_IDENTIFICAR = 'sin identificar';

function cobrosDeObraSocial(desde, hasta) {
  return and(eq(mediosPago.nombre, MEDIO_OBRA_SOCIAL), enRango(pagos.fecha_pago, desde, hasta));
}

async function porObraSocial(desde, hasta) {
  return db()
    .select({
      nombre: obrasSociales.nombre,
      total: suma(pagos.monto),
      cantidad: count(),
    })
    .from(pagos)
    .innerJoin(mediosPago, eq(mediosPago.id, pagos.medio_pago_id))
    .leftJoin(obrasSociales, eq(obrasSociales.id, pagos.obra_social_id))
    .where(cobrosDeObraSocial(desde, hasta))
    .groupBy(pagos.obra_social_id, obrasSociales.nombre)
    .orderBy(desc(sql`SUM(${pagos.monto})`));
}

async function porMes(desde, hasta) {
  const mesDelPago = mesDe(pagos.fecha_pago);

  return db()
    .select({ mes: mesDelPago, total: suma(pagos.monto) })
    .from(pagos)
    .innerJoin(mediosPago, eq(mediosPago.id, pagos.medio_pago_id))
    .where(cobrosDeObraSocial(desde, hasta))
    .groupBy(mesDelPago);
}

async function generar({ desde, hasta }) {
  const filas = await porObraSocial(desde, hasta);
  const mensual = await porMes(desde, hasta);
  const meses = mesesDelRango(desde, hasta);

  const total = redondear(filas.reduce((acumulado, fila) => acumulado + fila.total, 0));
  const cantidad = filas.reduce((acumulado, fila) => acumulado + fila.cantidad, 0);

  return {
    tarjetas: [
      tarjeta('total_cobrado', 'Total cobrado', total),
      tarjeta('cantidad_pagos', 'Cantidad de pagos', cantidad, FORMATOS.NUMERO),
    ],
    serie: serie(meses, [linea('cobrado', 'Cobrado', valoresPorMes(mensual, meses))]),
    indicadores: filas.map((fila) => {
      const nombre = fila.nombre || SIN_IDENTIFICAR;

      return indicador(`participacion_${clave(nombre)}`, `Participación de ${nombre}`, porcentaje(fila.total, total));
    }),
    detalle: null,
  };
}

module.exports = { generar };
