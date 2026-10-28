const { and, asc, count, desc, eq, isNotNull, sql, sum } = require('drizzle-orm');
const { alias } = require('drizzle-orm/sqlite-core');
const { db } = require('../db/d1');
const { egresos, mediosPago, usuarios } = require('../db/schema');

const ESTADO_ACTIVO = 'activo';
const ESTADO_ANULADO = 'anulado';

// usuarios entra dos veces: quién lo registró y quién lo anuló.
const anuladores = alias(usuarios, 'anuladores');

const COLUMNAS = {
  id: egresos.id,
  concepto: egresos.concepto,
  categoria: egresos.categoria,
  monto: egresos.monto,
  fecha: egresos.fecha,
  comprobante: egresos.comprobante,
  observaciones: egresos.observaciones,
  medio_pago_id: egresos.medio_pago_id,
  medio_pago: mediosPago.nombre,
  registrado_por: usuarios.nombre_completo,
  estado: egresos.estado,
  motivo_anulacion: egresos.motivo_anulacion,
  anulado_por: anuladores.nombre_completo,
  anulado_en: egresos.anulado_en,
};

function delPeriodo(anio, mes) {
  const periodo = `${anio}-${String(mes).padStart(2, '0')}`;

  return sql`substr(${egresos.fecha}, 1, 7) = ${periodo}`;
}

function filtro(anio, mes, categoria) {
  if (!categoria) {
    return delPeriodo(anio, mes);
  }

  return and(delPeriodo(anio, mes), sql`lower(${egresos.categoria}) = ${categoria.toLowerCase()}`);
}

function conDetalle(consulta) {
  return consulta
    .innerJoin(mediosPago, eq(mediosPago.id, egresos.medio_pago_id))
    .leftJoin(usuarios, eq(usuarios.id, egresos.usuario_id))
    .leftJoin(anuladores, eq(anuladores.id, egresos.anulado_por));
}

async function crear(datos) {
  const [fila] = await db()
    .insert(egresos)
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
    .returning({ id: egresos.id });

  return fila.id;
}

// El control de que no esté anulado va en el mismo UPDATE: si alguien lo anuló
// entre que se leyó y se guardó, no se pisa. Devuelve false si no tocó nada.
async function actualizar(egresoId, datos, usuarioId) {
  const filas = await db()
    .update(egresos)
    .set({
      medio_pago_id: datos.medioPagoId,
      concepto: datos.concepto,
      categoria: datos.categoria,
      monto: datos.monto,
      fecha: datos.fecha,
      comprobante: datos.comprobante ?? null,
      observaciones: datos.observaciones ?? null,
      modificado_por: usuarioId ?? null,
      modificado_en: sql`(datetime('now'))`,
    })
    .where(and(eq(egresos.id, egresoId), eq(egresos.estado, ESTADO_ACTIVO)))
    .returning({ id: egresos.id });

  return filas.length > 0;
}

// Igual que la edición: solo anula si sigue activo, para no anularlo dos veces.
async function anular(egresoId, motivo, usuarioId) {
  const filas = await db()
    .update(egresos)
    .set({
      estado: ESTADO_ANULADO,
      motivo_anulacion: motivo,
      anulado_por: usuarioId ?? null,
      anulado_en: sql`(datetime('now'))`,
    })
    .where(and(eq(egresos.id, egresoId), eq(egresos.estado, ESTADO_ACTIVO)))
    .returning({ id: egresos.id });

  return filas.length > 0;
}

async function obtener(egresoId) {
  const [fila] = await conDetalle(db().select(COLUMNAS).from(egresos))
    .where(eq(egresos.id, egresoId))
    .limit(1);

  return fila || null;
}

// Lista también los anulados (con su estado), pero no suman en el resumen.
async function listarPeriodo({ anio, mes, categoria, pagina, porPagina }) {
  const condicion = filtro(anio, mes, categoria);

  const [conteo] = await db()
    .select({ total: count() })
    .from(egresos)
    .where(condicion);

  const filas = await conDetalle(db().select(COLUMNAS).from(egresos))
    .where(condicion)
    .orderBy(desc(egresos.fecha), desc(egresos.id))
    .limit(porPagina)
    .offset((pagina - 1) * porPagina);

  return { egresos: filas, total: conteo ? conteo.total : 0 };
}

async function resumenPeriodo(anio, mes) {
  const activos = and(delPeriodo(anio, mes), eq(egresos.estado, ESTADO_ACTIVO));

  const [fila] = await db()
    .select({
      cantidad: count(),
      total: sql`COALESCE(SUM(${egresos.monto}), 0)`.mapWith(Number),
    })
    .from(egresos)
    .where(activos);

  const [anulados] = await db()
    .select({ cantidad: count() })
    .from(egresos)
    .where(and(delPeriodo(anio, mes), eq(egresos.estado, ESTADO_ANULADO)));

  const porCategoria = await db()
    .select({
      categoria: egresos.categoria,
      cantidad: count(),
      total: sql`COALESCE(SUM(${egresos.monto}), 0)`.mapWith(Number),
    })
    .from(egresos)
    .where(activos)
    .groupBy(egresos.categoria)
    .orderBy(desc(sql`SUM(${egresos.monto})`));

  return {
    cantidad: fila ? fila.cantidad : 0,
    total: fila ? fila.total : 0,
    anulados: anulados ? anulados.cantidad : 0,
    por_categoria: porCategoria,
  };
}

async function categoriasUsadas() {
  const filas = await db()
    .selectDistinct({ categoria: egresos.categoria })
    .from(egresos)
    .where(isNotNull(egresos.categoria))
    .orderBy(asc(egresos.categoria));

  return filas.map((fila) => fila.categoria);
}

module.exports = {
  ESTADO_ANULADO,
  crear,
  actualizar,
  anular,
  obtener,
  listarPeriodo,
  resumenPeriodo,
  categoriasUsadas,
};
