const { and, asc, desc, eq, sql } = require('drizzle-orm');
const { db } = require('../../db/d1');
const { egresos, mediosPago } = require('../../db/schema');
const {
  clave,
  enRango,
  etiquetaDe,
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

const ESTADO_ACTIVO = 'activo';
const SIN_CATEGORIA = 'sin categoría';
const CATEGORIAS_PRINCIPALES = 5;

// Los egresos anulados no suman.
function egresosDelRango(desde, hasta) {
  return and(enRango(egresos.fecha, desde, hasta), eq(egresos.estado, ESTADO_ACTIVO));
}

function categoria() {
  return sql`COALESCE(NULLIF(TRIM(${egresos.categoria}), ''), ${SIN_CATEGORIA})`;
}

async function catalogoDeMedios() {
  return db()
    .select({ id: mediosPago.id, nombre: mediosPago.nombre })
    .from(mediosPago)
    .orderBy(asc(mediosPago.nombre));
}

async function totalesPorMedio(desde, hasta) {
  return db()
    .select({ medio_pago_id: egresos.medio_pago_id, total: suma(egresos.monto) })
    .from(egresos)
    .where(egresosDelRango(desde, hasta))
    .groupBy(egresos.medio_pago_id);
}

async function porMesYMedio(desde, hasta) {
  const mesDelEgreso = mesDe(egresos.fecha);

  return db()
    .select({ mes: mesDelEgreso, medio_pago_id: egresos.medio_pago_id, total: suma(egresos.monto) })
    .from(egresos)
    .where(egresosDelRango(desde, hasta))
    .groupBy(mesDelEgreso, egresos.medio_pago_id);
}

// Las categorías son texto libre: se toman las que más gastaron en el rango.
async function categoriasPrincipales(desde, hasta) {
  const categoriaDelEgreso = categoria();

  return db()
    .select({ categoria: categoriaDelEgreso, total: suma(egresos.monto) })
    .from(egresos)
    .where(egresosDelRango(desde, hasta))
    .groupBy(categoriaDelEgreso)
    .orderBy(desc(sql`SUM(${egresos.monto})`))
    .limit(CATEGORIAS_PRINCIPALES);
}

async function generar({ desde, hasta }) {
  const catalogo = await catalogoDeMedios();
  const totales = await totalesPorMedio(desde, hasta);
  const mensual = await porMesYMedio(desde, hasta);
  const categorias = await categoriasPrincipales(desde, hasta);
  const meses = mesesDelRango(desde, hasta);

  const medios = catalogo.map((medio) => {
    const encontrado = totales.find((fila) => fila.medio_pago_id === medio.id);

    return {
      id: medio.id,
      nombre: medio.nombre,
      clave: clave(medio.nombre),
      total: encontrado ? encontrado.total : 0,
    };
  });

  const total = redondear(medios.reduce((acumulado, medio) => acumulado + medio.total, 0));

  return {
    tarjetas: [
      tarjeta('total', 'Total de egresos', total),
      ...medios.map((medio) => tarjeta(medio.clave, etiquetaDe(medio.nombre), medio.total)),
    ],
    serie: serie(
      meses,
      medios.map((medio) =>
        linea(
          medio.clave,
          etiquetaDe(medio.nombre),
          valoresPorMes(mensual.filter((fila) => fila.medio_pago_id === medio.id), meses)
        )
      )
    ),
    indicadores: [
      ...medios.map((medio) =>
        indicador(`participacion_${medio.clave}`, `Participación de ${medio.nombre}`, porcentaje(medio.total, total))
      ),
      ...categorias.map((fila) =>
        indicador(`categoria_${clave(fila.categoria)}`, etiquetaDe(fila.categoria), porcentaje(fila.total, total))
      ),
    ],
    detalle: null,
  };
}

module.exports = { generar };
