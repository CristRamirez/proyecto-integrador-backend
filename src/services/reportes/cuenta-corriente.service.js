const { and, ne, eq, sql } = require('drizzle-orm');
const { db } = require('../../db/d1');
const { cuotas, estadosCuota } = require('../../db/schema');
const {
  FORMATOS,
  enRango,
  indicador,
  linea,
  mesDe,
  mesesDelRango,
  porcentaje,
  serie,
  suma,
  tarjeta,
  valoresPorMes,
} = require('./comunes');

const ESTADO_ANULADA = 'anulada';

// Las cuotas del rango son las que vencen dentro de él. Las anuladas no cuentan.
function cuotasDelRango(desde, hasta) {
  return and(enRango(cuotas.fecha_vencimiento, desde, hasta), ne(estadosCuota.nombre, ESTADO_ANULADA));
}

// Lo cobrado de cada cuota es lo que ya se le descontó al saldo.
function cobrado() {
  return suma(sql`${cuotas.total} - ${cuotas.saldo_pendiente}`);
}

async function totales(desde, hasta) {
  const [fila] = await db()
    .select({ facturado: suma(cuotas.total), cobrado: cobrado(), pendiente: suma(cuotas.saldo_pendiente) })
    .from(cuotas)
    .innerJoin(estadosCuota, eq(estadosCuota.id, cuotas.estado_cuota_id))
    .where(cuotasDelRango(desde, hasta));

  return fila || { facturado: 0, cobrado: 0, pendiente: 0 };
}

async function porMes(desde, hasta) {
  const mesDeVencimiento = mesDe(cuotas.fecha_vencimiento);

  return db()
    .select({ mes: mesDeVencimiento, cobrado: cobrado(), pendiente: suma(cuotas.saldo_pendiente) })
    .from(cuotas)
    .innerJoin(estadosCuota, eq(estadosCuota.id, cuotas.estado_cuota_id))
    .where(cuotasDelRango(desde, hasta))
    .groupBy(mesDeVencimiento);
}

// Una fila por interno con cuántas de sus cuotas del rango tienen saldo, cuántas
// están pagas en parte y cuántas ya vencieron sin pagarse del todo.
async function situacionPorInterno(desde, hasta) {
  return db()
    .select({
      interno_id: cuotas.interno_id,
      con_saldo: sql`SUM(CASE WHEN ${cuotas.saldo_pendiente} > 0 THEN 1 ELSE 0 END)`.mapWith(Number),
      parciales: sql`SUM(CASE WHEN ${cuotas.saldo_pendiente} > 0 AND ${cuotas.saldo_pendiente} < ${cuotas.total} THEN 1 ELSE 0 END)`.mapWith(Number),
      vencidas: sql`SUM(CASE WHEN ${cuotas.saldo_pendiente} > 0 AND ${cuotas.fecha_vencimiento} < date('now') THEN 1 ELSE 0 END)`.mapWith(Number),
    })
    .from(cuotas)
    .innerJoin(estadosCuota, eq(estadosCuota.id, cuotas.estado_cuota_id))
    .where(cuotasDelRango(desde, hasta))
    .groupBy(cuotas.interno_id);
}

async function generar({ desde, hasta }) {
  const { facturado, cobrado: totalCobrado, pendiente } = await totales(desde, hasta);
  const mensual = await porMes(desde, hasta);
  const internos = await situacionPorInterno(desde, hasta);
  const meses = mesesDelRango(desde, hasta);

  const conCuotas = internos.length;
  const conDeuda = internos.filter((interno) => interno.con_saldo > 0).length;
  const conParcial = internos.filter((interno) => interno.parciales > 0).length;
  const enMora = internos.filter((interno) => interno.vencidas > 0).length;
  const alDia = conCuotas - enMora;

  return {
    tarjetas: [
      tarjeta('facturado', 'Facturado', facturado),
      tarjeta('cobrado', 'Cobrado', totalCobrado),
      tarjeta('pendiente', 'Pendiente', pendiente),
    ],
    serie: serie(meses, [
      linea('cobrado', 'Cobrado', valoresPorMes(mensual, meses, 'cobrado')),
      linea('pendiente', 'Pendiente', valoresPorMes(mensual, meses, 'pendiente')),
    ]),
    indicadores: [
      indicador('internos_con_cuotas', 'Internos con cuotas', conCuotas, FORMATOS.NUMERO),
      indicador('con_deuda', 'Internos con deuda', porcentaje(conDeuda, conCuotas)),
      indicador('con_pago_parcial', 'Internos con pago parcial', porcentaje(conParcial, conCuotas)),
      indicador('en_mora', 'Internos en mora', porcentaje(enMora, conCuotas)),
      indicador('al_dia', 'Internos al día', porcentaje(alDia, conCuotas)),
    ],
    detalle: null,
  };
}

module.exports = { generar };
