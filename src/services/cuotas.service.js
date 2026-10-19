const { and, asc, count, eq, gt, lt, ne, notExists, sql } = require('drizzle-orm');
const { db } = require('../db/d1');
const { cuotas, internos, estados, estadosCuota, mediosPago, pagos } = require('../db/schema');
const { coincideCon, ultimoLegajo } = require('./internos.service');

async function buscarEstadoPorNombre(nombre) {
  const [fila] = await db()
    .select({ id: estadosCuota.id, nombre: estadosCuota.nombre })
    .from(estadosCuota)
    .where(eq(estadosCuota.nombre, nombre))
    .limit(1);

  return fila || null;
}

async function contarInternosActivos() {
  const [fila] = await db()
    .select({ total: count() })
    .from(internos)
    .innerJoin(estados, eq(estados.id, internos.estado_id))
    .where(eq(estados.nombre, 'activo'));

  return fila ? fila.total : 0;
}

async function internosActivosSinCuota(anio, mes) {
  const filas = await db()
    .select({ id: internos.id })
    .from(internos)
    .innerJoin(estados, eq(estados.id, internos.estado_id))
    .where(
      and(
        eq(estados.nombre, 'activo'),
        notExists(
          db()
            .select({ id: cuotas.id })
            .from(cuotas)
            .where(
              and(
                eq(cuotas.interno_id, internos.id),
                eq(cuotas.periodo_anio, anio),
                eq(cuotas.periodo_mes, mes)
              )
            )
        )
      )
    )
    .orderBy(asc(internos.id));

  return filas.map((fila) => fila.id);
}

async function crear(datos) {
  const [fila] = await db()
    .insert(cuotas)
    .values({
      interno_id: datos.internoId,
      config_cuota_id: datos.configId,
      estado_cuota_id: datos.estadoCuotaId,
      periodo_anio: datos.anio,
      periodo_mes: datos.mes,
      valor_base: datos.valorBase,
      interes_aplicado: 0,
      total: datos.valorBase,
      saldo_pendiente: datos.valorBase,
      fecha_vencimiento: datos.fechaVencimiento,
    })
    .returning({ id: cuotas.id });

  return fila.id;
}

function conPeriodo({ periodo_anio, periodo_mes, ...cuota }) {
  return { ...cuota, periodo: `${periodo_anio}-${String(periodo_mes).padStart(2, '0')}` };
}

function estaVencida() {
  return and(gt(cuotas.saldo_pendiente, 0), lt(cuotas.fecha_vencimiento, sql`date('now')`));
}

function vencidaEnSql() {
  return sql`${cuotas.saldo_pendiente} > 0 AND ${cuotas.fecha_vencimiento} < date('now')`;
}

function filtroDelPeriodo({ anio, mes, estado, palabras }) {
  const condiciones = [eq(cuotas.periodo_anio, anio), eq(cuotas.periodo_mes, mes)];

  if (estado === 'vencida') {
    condiciones.push(ne(estadosCuota.nombre, 'anulada'), estaVencida());
  } else if (estado) {
    condiciones.push(eq(estadosCuota.nombre, estado));
  }

  for (const palabra of palabras) {
    condiciones.push(coincideCon(palabra));
  }

  return and(...condiciones);
}

async function ultimoPagoDeCada(ids) {
  const ultimos = new Map();

  if (!ids.length) {
    return ultimos;
  }

  const filas = await db()
    .select({
      cuota_id: pagos.cuota_id,
      fecha_pago: pagos.fecha_pago,
      numero_comprobante: pagos.numero_comprobante,
      medio_pago: mediosPago.nombre,
    })
    .from(pagos)
    .innerJoin(mediosPago, eq(mediosPago.id, pagos.medio_pago_id))
    .where(sql`${pagos.cuota_id} IN (${sql.raw(ids.join(', '))})`)
    .orderBy(asc(pagos.fecha_pago), asc(pagos.id));

  for (const { cuota_id: cuotaId, ...pago } of filas) {
    ultimos.set(cuotaId, pago);
  }

  return ultimos;
}

async function listarPeriodo(criterios) {
  const condicion = filtroDelPeriodo(criterios);

  const [conteo] = await db()
    .select({ total: count() })
    .from(cuotas)
    .innerJoin(estadosCuota, eq(estadosCuota.id, cuotas.estado_cuota_id))
    .innerJoin(internos, eq(internos.id, cuotas.interno_id))
    .where(condicion);

  const filas = await db()
    .select({
      id: cuotas.id,
      interno_id: cuotas.interno_id,
      periodo_anio: cuotas.periodo_anio,
      periodo_mes: cuotas.periodo_mes,
      valor_base: cuotas.valor_base,
      interes_aplicado: cuotas.interes_aplicado,
      total: cuotas.total,
      saldo_pendiente: cuotas.saldo_pendiente,
      estado: estadosCuota.nombre,
      fecha_vencimiento: cuotas.fecha_vencimiento,
      dni: internos.dni,
      apellido: internos.apellido,
      nombre: internos.nombre,
      legajo: ultimoLegajo(),
    })
    .from(cuotas)
    .innerJoin(estadosCuota, eq(estadosCuota.id, cuotas.estado_cuota_id))
    .innerJoin(internos, eq(internos.id, cuotas.interno_id))
    .where(condicion)
    .orderBy(asc(internos.apellido), asc(internos.nombre), asc(cuotas.id))
    .limit(criterios.porPagina)
    .offset((criterios.pagina - 1) * criterios.porPagina);

  const ultimos = await ultimoPagoDeCada(filas.map((fila) => fila.id));

  const armadas = filas.map(({ dni, apellido, nombre, legajo, ...cuota }) => ({
    ...conPeriodo(cuota),
    interno: { id: cuota.interno_id, dni, apellido, nombre, legajo: legajo ?? null },
    ultimo_pago: ultimos.get(cuota.id) ?? null,
  }));

  return { cuotas: armadas, total: conteo ? conteo.total : 0 };
}

async function resumenDelPeriodo(anio, mes) {
  const [fila] = await db()
    .select({
      cuotas: count(),
      facturado: sql`COALESCE(SUM(${cuotas.total}), 0)`.mapWith(Number),
      saldos: sql`COALESCE(SUM(${cuotas.saldo_pendiente}), 0)`.mapWith(Number),
      vencido: sql`COALESCE(SUM(CASE WHEN ${vencidaEnSql()} THEN ${cuotas.saldo_pendiente} ELSE 0 END), 0)`.mapWith(Number),
      cuotas_pendientes: sql`COUNT(CASE WHEN ${cuotas.saldo_pendiente} > 0 AND NOT (${vencidaEnSql()}) THEN 1 END)`.mapWith(Number),
      internos_con_vencidas: sql`COUNT(DISTINCT CASE WHEN ${vencidaEnSql()} THEN ${cuotas.interno_id} END)`.mapWith(Number),
    })
    .from(cuotas)
    .innerJoin(estadosCuota, eq(estadosCuota.id, cuotas.estado_cuota_id))
    .where(and(eq(cuotas.periodo_anio, anio), eq(cuotas.periodo_mes, mes), ne(estadosCuota.nombre, 'anulada')));

  return fila || { cuotas: 0, facturado: 0, saldos: 0, vencido: 0, cuotas_pendientes: 0, internos_con_vencidas: 0 };
}

module.exports = {
  buscarEstadoPorNombre,
  contarInternosActivos,
  internosActivosSinCuota,
  crear,
  listarPeriodo,
  resumenDelPeriodo,
};
