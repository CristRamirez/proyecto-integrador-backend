const { asc } = require('drizzle-orm');
const { db } = require('../../db/d1');
const { mediosPago, pagos } = require('../../db/schema');
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

async function catalogoDeMedios() {
  return db()
    .select({ id: mediosPago.id, nombre: mediosPago.nombre })
    .from(mediosPago)
    .orderBy(asc(mediosPago.nombre));
}

async function totalesPorMedio(desde, hasta) {
  return db()
    .select({ medio_pago_id: pagos.medio_pago_id, total: suma(pagos.monto) })
    .from(pagos)
    .where(enRango(pagos.fecha_pago, desde, hasta))
    .groupBy(pagos.medio_pago_id);
}

async function porMesYMedio(desde, hasta) {
  const mesDelPago = mesDe(pagos.fecha_pago);

  return db()
    .select({ mes: mesDelPago, medio_pago_id: pagos.medio_pago_id, total: suma(pagos.monto) })
    .from(pagos)
    .where(enRango(pagos.fecha_pago, desde, hasta))
    .groupBy(mesDelPago, pagos.medio_pago_id);
}

async function generar({ desde, hasta }) {
  const catalogo = await catalogoDeMedios();
  const totales = await totalesPorMedio(desde, hasta);
  const mensual = await porMesYMedio(desde, hasta);
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
      tarjeta('total', 'Total cobrado', total),
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
    indicadores: medios.map((medio) =>
      indicador(`participacion_${medio.clave}`, `Participación de ${medio.nombre}`, porcentaje(medio.total, total))
    ),
    detalle: null,
  };
}

module.exports = { generar };
