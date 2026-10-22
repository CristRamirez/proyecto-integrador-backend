const { and, asc, count, desc, eq, isNotNull, sql, sum } = require('drizzle-orm');
const { db } = require('../db/d1');
const { egresos, mediosPago, usuarios } = require('../db/schema');

const COLUMNAS = {
  id: egresos.id,
  concepto: egresos.concepto,
  categoria: egresos.categoria,
  monto: egresos.monto,
  fecha: egresos.fecha,
  comprobante: egresos.comprobante,
  observaciones: egresos.observaciones,
  medio_pago: mediosPago.nombre,
  registrado_por: usuarios.nombre_completo,
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

async function obtener(egresoId) {
  const [fila] = await db()
    .select(COLUMNAS)
    .from(egresos)
    .innerJoin(mediosPago, eq(mediosPago.id, egresos.medio_pago_id))
    .leftJoin(usuarios, eq(usuarios.id, egresos.usuario_id))
    .where(eq(egresos.id, egresoId))
    .limit(1);

  return fila || null;
}

async function listarPeriodo({ anio, mes, categoria, pagina, porPagina }) {
  const condicion = filtro(anio, mes, categoria);

  const [conteo] = await db()
    .select({ total: count() })
    .from(egresos)
    .where(condicion);

  const filas = await db()
    .select(COLUMNAS)
    .from(egresos)
    .innerJoin(mediosPago, eq(mediosPago.id, egresos.medio_pago_id))
    .leftJoin(usuarios, eq(usuarios.id, egresos.usuario_id))
    .where(condicion)
    .orderBy(desc(egresos.fecha), desc(egresos.id))
    .limit(porPagina)
    .offset((pagina - 1) * porPagina);

  return { egresos: filas, total: conteo ? conteo.total : 0 };
}

async function resumenPeriodo(anio, mes) {
  const [fila] = await db()
    .select({
      cantidad: count(),
      total: sql`COALESCE(SUM(${egresos.monto}), 0)`.mapWith(Number),
    })
    .from(egresos)
    .where(delPeriodo(anio, mes));

  const porCategoria = await db()
    .select({
      categoria: egresos.categoria,
      cantidad: count(),
      total: sql`COALESCE(SUM(${egresos.monto}), 0)`.mapWith(Number),
    })
    .from(egresos)
    .where(delPeriodo(anio, mes))
    .groupBy(egresos.categoria)
    .orderBy(desc(sql`SUM(${egresos.monto})`));

  return {
    cantidad: fila ? fila.cantidad : 0,
    total: fila ? fila.total : 0,
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

module.exports = { crear, obtener, listarPeriodo, resumenPeriodo, categoriasUsadas };
