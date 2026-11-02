const { eq, sql } = require('drizzle-orm');
const { db } = require('../../db/d1');
const { cuotas, estados, internos, obrasSociales, pagos } = require('../../db/schema');
const {
  FORMATOS,
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

const ESTADO_ACTIVO = 'activo';
const SIN_COBERTURA = 'Sin cobertura';

// Siempre las dos, en el mismo orden, aunque alguna no haya tenido cobros.
const COBERTURAS = [
  { clave: 'obra_social', etiqueta: 'Con obra social', tarjeta: 'Cobrado con obra social' },
  { clave: 'particular', etiqueta: 'Particulares', tarjeta: 'Cobrado a particulares' },
];

// Particular es el que no tiene obra social cargada o tiene "Sin cobertura".
function esParticular() {
  return sql`(${internos.obra_social_id} IS NULL OR ${obrasSociales.nombre} = ${SIN_COBERTURA})`;
}

function cobertura() {
  return sql`CASE WHEN ${esParticular()} THEN 'particular' ELSE 'obra_social' END`;
}

function pagosConCobertura(campos) {
  return db()
    .select(campos)
    .from(pagos)
    .innerJoin(cuotas, eq(cuotas.id, pagos.cuota_id))
    .innerJoin(internos, eq(internos.id, cuotas.interno_id))
    .leftJoin(obrasSociales, eq(obrasSociales.id, internos.obra_social_id));
}

async function cobradoPorCobertura(desde, hasta) {
  const coberturaDelInterno = cobertura();

  return pagosConCobertura({ cobertura: coberturaDelInterno, total: suma(pagos.monto) })
    .where(enRango(pagos.fecha_pago, desde, hasta))
    .groupBy(coberturaDelInterno);
}

async function porMesYCobertura(desde, hasta) {
  const mesDelPago = mesDe(pagos.fecha_pago);
  const coberturaDelInterno = cobertura();

  return pagosConCobertura({ mes: mesDelPago, cobertura: coberturaDelInterno, total: suma(pagos.monto) })
    .where(enRango(pagos.fecha_pago, desde, hasta))
    .groupBy(mesDelPago, coberturaDelInterno);
}

// Los internos activos hoy: no depende del rango, es la foto actual.
async function activos() {
  const [fila] = await db()
    .select({
      total: sql`COUNT(*)`.mapWith(Number),
      judicializados: sql`COALESCE(SUM(CASE WHEN ${internos.judicializado} = 1 THEN 1 ELSE 0 END), 0)`.mapWith(Number),
      particulares: sql`COALESCE(SUM(CASE WHEN ${esParticular()} THEN 1 ELSE 0 END), 0)`.mapWith(Number),
    })
    .from(internos)
    .innerJoin(estados, eq(estados.id, internos.estado_id))
    .leftJoin(obrasSociales, eq(obrasSociales.id, internos.obra_social_id))
    .where(eq(estados.nombre, ESTADO_ACTIVO));

  return fila || { total: 0, judicializados: 0, particulares: 0 };
}

async function generar({ desde, hasta }) {
  const totales = await cobradoPorCobertura(desde, hasta);
  const mensual = await porMesYCobertura(desde, hasta);
  const actuales = await activos();
  const meses = mesesDelRango(desde, hasta);

  const coberturas = COBERTURAS.map((tipo) => {
    const encontrado = totales.find((fila) => fila.cobertura === tipo.clave);

    return { ...tipo, total: encontrado ? encontrado.total : 0 };
  });

  const total = redondear(coberturas.reduce((acumulado, tipo) => acumulado + tipo.total, 0));
  const conObraSocial = actuales.total - actuales.particulares;

  return {
    tarjetas: [
      tarjeta('total', 'Total cobrado', total),
      ...coberturas.map((tipo) => tarjeta(tipo.clave, tipo.tarjeta, tipo.total)),
    ],
    serie: serie(
      meses,
      coberturas.map((tipo) =>
        linea(tipo.clave, tipo.etiqueta, valoresPorMes(mensual.filter((fila) => fila.cobertura === tipo.clave), meses))
      )
    ),
    indicadores: [
      indicador('activos', 'Internos activos', actuales.total, FORMATOS.NUMERO),
      indicador('judicializados', 'Judicializados', porcentaje(actuales.judicializados, actuales.total)),
      indicador('con_obra_social', 'Con obra social', porcentaje(conObraSocial, actuales.total)),
      indicador('particulares', 'Particulares', porcentaje(actuales.particulares, actuales.total)),
    ],
    detalle: null,
  };
}

module.exports = { generar };
