const { and, asc, count, desc, eq, isNotNull, sql } = require('drizzle-orm');
const { alias } = require('drizzle-orm/sqlite-core');
const { db } = require('../db/d1');
const { ingresos, mediosPago, usuarios } = require('../db/schema');

const ESTADO_ACTIVO = 'activo';
const ESTADO_ANULADO = 'anulado';

const anuladores = alias(usuarios, 'anuladores_ingresos');

const COLUMNAS = {
  id: ingresos.id,
  concepto: ingresos.concepto,
  categoria: ingresos.categoria,
  monto: ingresos.monto,
  fecha: ingresos.fecha,
  comprobante: ingresos.comprobante,
  observaciones: ingresos.observaciones,
  medio_pago_id: ingresos.medio_pago_id,
  medio_pago: mediosPago.nombre,
  registrado_por: usuarios.nombre_completo,
  estado: ingresos.estado,
  motivo_anulacion: ingresos.motivo_anulacion,
  anulado_por: anuladores.nombre_completo,
  anulado_en: ingresos.anulado_en,
};

function conRelaciones(consulta) {
  return consulta
    .innerJoin(mediosPago, eq(mediosPago.id, ingresos.medio_pago_id))
    .leftJoin(usuarios, eq(usuarios.id, ingresos.usuario_id))
    .leftJoin(anuladores, eq(anuladores.id, ingresos.anulado_por));
}

function delPeriodo(anio, mes) {
  const periodo = `${anio}-${String(mes).padStart(2, '0')}`;

  return sql`substr(${ingresos.fecha}, 1, 7) = ${periodo}`;
}

function filtro(anio, mes, categoria) {
  if (!categoria) {
    return delPeriodo(anio, mes);
  }

  return and(delPeriodo(anio, mes), sql`lower(${ingresos.categoria}) = ${categoria.toLowerCase()}`);
}

async function crear(datos) {
  const [fila] = await db()
    .insert(ingresos)
    .values({
      medio_pago_id: datos.medioPagoId,
      concepto: datos.concepto,
      categoria: datos.categoria,
      monto: datos.monto,
      comprobante: datos.comprobante ?? null,
      observaciones: datos.observaciones ?? null,
      usuario_id: datos.usuarioId ?? null,
      ...(datos.fecha ? { fecha: datos.fecha } : {}),
    })
    .returning({ id: ingresos.id });

  return fila.id;
}

async function obtener(ingresoId) {
  const [fila] = await conRelaciones(db().select(COLUMNAS).from(ingresos))
    .where(eq(ingresos.id, ingresoId))
    .limit(1);

  return fila || null;
}

async function anular(ingresoId, motivo, usuarioId) {
  const filas = await db()
    .update(ingresos)
    .set({
      estado: ESTADO_ANULADO,
      motivo_anulacion: motivo,
      anulado_por: usuarioId ?? null,
      anulado_en: sql`(datetime('now'))`,
    })
    .where(and(eq(ingresos.id, ingresoId), eq(ingresos.estado, ESTADO_ACTIVO)))
    .returning({ id: ingresos.id });

  return filas.length > 0;
}

async function listarPeriodo({ anio, mes, categoria, pagina, porPagina }) {
  const condicion = filtro(anio, mes, categoria);

  const [conteo] = await db().select({ total: count() }).from(ingresos).where(condicion);

  const filas = await conRelaciones(db().select(COLUMNAS).from(ingresos))
    .where(condicion)
    .orderBy(desc(ingresos.fecha), desc(ingresos.id))
    .limit(porPagina)
    .offset((pagina - 1) * porPagina);

  return { ingresos: filas, total: conteo ? conteo.total : 0 };
}

async function resumenPeriodo(anio, mes) {
  const activos = and(delPeriodo(anio, mes), eq(ingresos.estado, ESTADO_ACTIVO));

  const [fila] = await db()
    .select({
      cantidad: count(),
      total: sql`COALESCE(SUM(${ingresos.monto}), 0)`.mapWith(Number),
    })
    .from(ingresos)
    .where(activos);

  const [anulados] = await db()
    .select({ cantidad: count() })
    .from(ingresos)
    .where(and(delPeriodo(anio, mes), eq(ingresos.estado, ESTADO_ANULADO)));

  const porCategoria = await db()
    .select({
      categoria: ingresos.categoria,
      cantidad: count(),
      total: sql`COALESCE(SUM(${ingresos.monto}), 0)`.mapWith(Number),
    })
    .from(ingresos)
    .where(activos)
    .groupBy(ingresos.categoria)
    .orderBy(desc(sql`SUM(${ingresos.monto})`));

  return {
    cantidad: fila ? fila.cantidad : 0,
    total: fila ? fila.total : 0,
    anulados: anulados ? anulados.cantidad : 0,
    por_categoria: porCategoria,
  };
}

async function categoriasUsadas() {
  const filas = await db()
    .selectDistinct({ categoria: ingresos.categoria })
    .from(ingresos)
    .where(isNotNull(ingresos.categoria))
    .orderBy(asc(ingresos.categoria));

  return filas.map((fila) => fila.categoria);
}

module.exports = {
  ESTADO_ACTIVO,
  ESTADO_ANULADO,
  crear,
  obtener,
  anular,
  listarPeriodo,
  resumenPeriodo,
  categoriasUsadas,
};
