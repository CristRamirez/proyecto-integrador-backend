const { and, asc, eq, gt, lt, max, ne, sql } = require('drizzle-orm');
const { db } = require('../../db/d1');
const { cuotas, estadosCuota, internos, pagos } = require('../../db/schema');
const { ultimoLegajo } = require('../internos.service');
const {
  FORMATOS,
  columna,
  enRango,
  indicador,
  linea,
  redondear,
  serie,
  tabla,
  tarjeta,
} = require('./comunes');

const ESTADO_ANULADA = 'anulada';

const TRAMOS = [
  { etiqueta: 'Hasta 30 días', hasta: 30 },
  { etiqueta: '31 a 60 días', hasta: 60 },
  { etiqueta: '61 a 90 días', hasta: 90 },
  { etiqueta: 'Más de 90 días', hasta: Infinity },
];

const COLUMNAS_DETALLE = [
  columna('legajo', 'Legajo'),
  columna('interno', 'Interno'),
  columna('dni', 'DNI'),
  columna('cuotas', 'Cuotas adeudadas', FORMATOS.NUMERO),
  columna('periodos', 'Períodos'),
  columna('saldo', 'Saldo', FORMATOS.MONEDA),
  columna('antiguedad_dias', 'Antigüedad (días)', FORMATOS.NUMERO),
  columna('ultimo_pago', 'Último pago'),
];

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function diasEntre(desde, hasta) {
  return Math.floor((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);
}

function periodoDe(fila) {
  return `${fila.periodo_anio}-${String(fila.periodo_mes).padStart(2, '0')}`;
}

async function cuotasConSaldo(desde, hasta) {
  return db()
    .select({
      interno_id: internos.id,
      dni: internos.dni,
      apellido: internos.apellido,
      nombre: internos.nombre,
      legajo: ultimoLegajo(),
      periodo_anio: cuotas.periodo_anio,
      periodo_mes: cuotas.periodo_mes,
      saldo: cuotas.saldo_pendiente,
      fecha_vencimiento: cuotas.fecha_vencimiento,
    })
    .from(cuotas)
    .innerJoin(internos, eq(internos.id, cuotas.interno_id))
    .innerJoin(estadosCuota, eq(estadosCuota.id, cuotas.estado_cuota_id))
    .where(
      and(
        enRango(cuotas.fecha_vencimiento, desde, hasta),
        lt(cuotas.fecha_vencimiento, sql`date('now')`),
        ne(estadosCuota.nombre, ESTADO_ANULADA),
        gt(cuotas.saldo_pendiente, 0)
      )
    )
    .orderBy(asc(internos.id), asc(cuotas.periodo_anio), asc(cuotas.periodo_mes));
}

async function ultimosPagos() {
  return db()
    .select({ interno_id: cuotas.interno_id, fecha: max(pagos.fecha_pago) })
    .from(pagos)
    .innerJoin(cuotas, eq(cuotas.id, pagos.cuota_id))
    .groupBy(cuotas.interno_id);
}

function agrupar(filas, pagosPorInterno) {
  const porInterno = new Map();
  const dia = hoy();

  for (const fila of filas) {
    if (!porInterno.has(fila.interno_id)) {
      porInterno.set(fila.interno_id, {
        legajo: fila.legajo || null,
        interno: `${fila.apellido}, ${fila.nombre}`,
        dni: fila.dni,
        cuotas: 0,
        periodos: [],
        saldo: 0,
        vencimientos: [],
      });
    }

    const interno = porInterno.get(fila.interno_id);

    interno.cuotas += 1;
    interno.periodos.push(periodoDe(fila));
    interno.saldo += fila.saldo;
    interno.vencimientos.push(fila.fecha_vencimiento);
  }

  return [...porInterno.entries()].map(([id, interno]) => {
    const masViejo = interno.vencimientos.slice().sort()[0];
    const pago = pagosPorInterno.get(id);

    return {
      legajo: interno.legajo,
      interno: interno.interno,
      dni: interno.dni,
      cuotas: interno.cuotas,
      periodos: interno.periodos.join(', '),
      saldo: redondear(interno.saldo),
      antiguedad_dias: diasEntre(masViejo, dia),
      ultimo_pago: pago ? pago.slice(0, 10) : null,
    };
  });
}

function porTramo(filas) {
  const dia = hoy();
  const totales = TRAMOS.map(() => 0);

  for (const fila of filas) {
    const vencido = diasEntre(fila.fecha_vencimiento, dia);
    const indice = TRAMOS.findIndex((tramo) => vencido <= tramo.hasta);

    totales[indice === -1 ? TRAMOS.length - 1 : indice] += fila.saldo;
  }

  return totales.map(redondear);
}

async function generar({ desde, hasta }) {
  const filas = await cuotasConSaldo(desde, hasta);
  const pagosPorInterno = new Map((await ultimosPagos()).map((fila) => [fila.interno_id, fila.fecha]));

  const detalle = agrupar(filas, pagosPorInterno).sort((uno, otro) => otro.saldo - uno.saldo);
  const total = redondear(filas.reduce((acumulado, fila) => acumulado + fila.saldo, 0));
  const antiguedades = detalle.map((interno) => interno.antiguedad_dias);
  const promedio = (valores) => (valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0);

  return {
    tarjetas: [
      tarjeta('total_adeudado', 'Total adeudado', total),
      tarjeta('internos_con_deuda', 'Internos con deuda', detalle.length, FORMATOS.NUMERO),
      tarjeta('cuotas_vencidas', 'Cuotas vencidas', filas.length, FORMATOS.NUMERO),
    ],
    serie: serie(
      TRAMOS.map((tramo) => tramo.etiqueta),
      [linea('saldo', 'Saldo adeudado', porTramo(filas))]
    ),
    indicadores: [
      indicador('promedio_por_interno', 'Promedio por interno', promedio(detalle.map((i) => i.saldo)), FORMATOS.MONEDA),
      indicador('antiguedad_promedio', 'Antigüedad promedio (días)', promedio(antiguedades), FORMATOS.NUMERO),
      indicador('antiguedad_maxima', 'Antigüedad máxima (días)', antiguedades.length ? Math.max(...antiguedades) : 0, FORMATOS.NUMERO),
    ],
    detalle: tabla(COLUMNAS_DETALLE, detalle),
  };
}

module.exports = { generar };
