const { and, eq } = require('drizzle-orm');
const { db } = require('../../db/d1');
const { egresos, pagos } = require('../../db/schema');
const {
  FORMATOS,
  enRango,
  mesDe,
  suma,
  indicador,
  linea,
  mesesDelRango,
  porcentaje,
  redondear,
  serie,
  tarjeta,
  valoresPorMes,
} = require('./comunes');

const ESTADO_ACTIVO = 'activo';

function egresosDelRango(desde, hasta) {
  return and(enRango(egresos.fecha, desde, hasta), eq(egresos.estado, ESTADO_ACTIVO));
}

async function totales(desde, hasta) {
  const [cobrado] = await db()
    .select({ total: suma(pagos.monto) })
    .from(pagos)
    .where(enRango(pagos.fecha_pago, desde, hasta));

  const [gastado] = await db()
    .select({ total: suma(egresos.monto) })
    .from(egresos)
    .where(egresosDelRango(desde, hasta));

  return { ingresos: cobrado ? cobrado.total : 0, egresos: gastado ? gastado.total : 0 };
}

async function porMes(desde, hasta) {
  const mesDelPago = mesDe(pagos.fecha_pago);
  const mesDelEgreso = mesDe(egresos.fecha);

  const ingresos = await db()
    .select({ mes: mesDelPago, total: suma(pagos.monto) })
    .from(pagos)
    .where(enRango(pagos.fecha_pago, desde, hasta))
    .groupBy(mesDelPago);

  const gastos = await db()
    .select({ mes: mesDelEgreso, total: suma(egresos.monto) })
    .from(egresos)
    .where(egresosDelRango(desde, hasta))
    .groupBy(mesDelEgreso);

  return { ingresos, egresos: gastos };
}

async function generar({ desde, hasta }) {
  const { ingresos, egresos: gastos } = await totales(desde, hasta);
  const balance = redondear(ingresos - gastos);
  const mensual = await porMes(desde, hasta);
  const meses = mesesDelRango(desde, hasta);

  return {
    tarjetas: [
      tarjeta('ingresos', 'Ingresos cobrados', ingresos),
      tarjeta('egresos', 'Egresos', gastos),
      tarjeta('balance', 'Balance', balance),
    ],
    serie: serie(meses, [
      linea('ingresos', 'Ingresos', valoresPorMes(mensual.ingresos, meses)),
      linea('egresos', 'Egresos', valoresPorMes(mensual.egresos, meses)),
    ]),
    indicadores: [
      indicador('egresos_sobre_ingresos', 'Egresos sobre los ingresos', porcentaje(gastos, ingresos)),
      indicador('balance_sobre_ingresos', 'Balance sobre los ingresos', porcentaje(balance, ingresos)),
      indicador('meses', 'Meses del rango', meses.length, FORMATOS.NUMERO),
    ],
    detalle: null,
  };
}

module.exports = { generar };
