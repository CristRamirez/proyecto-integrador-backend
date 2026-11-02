const { and, isNotNull, sql } = require('drizzle-orm');
const { db } = require('../../db/d1');
const { legajos } = require('../../db/schema');
const {
  FORMATOS,
  enRango,
  indicador,
  linea,
  mesDe,
  mesesDelRango,
  porcentaje,
  serie,
  tarjeta,
  valoresPorMes,
} = require('./comunes');

const TIPOS = [
  { clave: 'alta_terapeutica', etiqueta: 'Alta terapéutica' },
  { clave: 'abandono', etiqueta: 'Abandono' },
  { clave: 'derivacion', etiqueta: 'Derivación' },
  { clave: 'otro', etiqueta: 'Otro' },
];

const RECUPERADO = 'alta_terapeutica';
const ABANDONO = 'abandono';

// Un egreso es un legajo cerrado dentro del rango. Si alguno quedó sin tipo
// cuenta como 'otro', igual que los que se cerraron antes de la migración.
function egresosDelRango(desde, hasta) {
  return and(isNotNull(legajos.fecha_egreso), enRango(legajos.fecha_egreso, desde, hasta));
}

function tipo() {
  return sql`COALESCE(${legajos.tipo_egreso}, 'otro')`;
}

function cantidad() {
  return sql`COUNT(*)`.mapWith(Number);
}

async function totalesPorTipo(desde, hasta) {
  const tipoDelEgreso = tipo();

  return db()
    .select({ tipo: tipoDelEgreso, total: cantidad() })
    .from(legajos)
    .where(egresosDelRango(desde, hasta))
    .groupBy(tipoDelEgreso);
}

async function porMesYTipo(desde, hasta) {
  const mesDelEgreso = mesDe(legajos.fecha_egreso);
  const tipoDelEgreso = tipo();

  return db()
    .select({ mes: mesDelEgreso, tipo: tipoDelEgreso, total: cantidad() })
    .from(legajos)
    .where(egresosDelRango(desde, hasta))
    .groupBy(mesDelEgreso, tipoDelEgreso);
}

// Solo entran los legajos que tienen fecha de ingreso para medir la estadía.
async function diasPromedioDeEstadia(desde, hasta) {
  const [fila] = await db()
    .select({
      dias: sql`AVG(julianday(${legajos.fecha_egreso}) - julianday(${legajos.fecha_ingreso}))`.mapWith(Number),
    })
    .from(legajos)
    .where(and(egresosDelRango(desde, hasta), isNotNull(legajos.fecha_ingreso)));

  return (fila && fila.dias) || 0;
}

async function generar({ desde, hasta }) {
  const totales = await totalesPorTipo(desde, hasta);
  const mensual = await porMesYTipo(desde, hasta);
  const dias = await diasPromedioDeEstadia(desde, hasta);
  const meses = mesesDelRango(desde, hasta);

  const tipos = TIPOS.map((uno) => {
    const encontrado = totales.find((fila) => fila.tipo === uno.clave);

    return { ...uno, total: encontrado ? encontrado.total : 0 };
  });

  const total = tipos.reduce((acumulado, uno) => acumulado + uno.total, 0);
  const totalDe = (clave) => tipos.find((uno) => uno.clave === clave).total;

  return {
    tarjetas: [
      tarjeta('recuperados', 'Recuperados', totalDe(RECUPERADO), FORMATOS.NUMERO),
      tarjeta('abandonos', 'Abandonos', totalDe(ABANDONO), FORMATOS.NUMERO),
      tarjeta('tasa_recuperacion', 'Tasa de recuperación', porcentaje(totalDe(RECUPERADO), total), FORMATOS.PORCENTAJE),
    ],
    serie: serie(
      meses,
      tipos.map((uno) =>
        linea(uno.clave, uno.etiqueta, valoresPorMes(mensual.filter((fila) => fila.tipo === uno.clave), meses))
      )
    ),
    indicadores: [
      indicador('egresos', 'Egresos del rango', total, FORMATOS.NUMERO),
      ...tipos.map((uno) => indicador(`porcentaje_${uno.clave}`, uno.etiqueta, porcentaje(uno.total, total))),
      indicador('dias_promedio_estadia', 'Días promedio de estadía', dias, FORMATOS.NUMERO),
    ],
    detalle: null,
  };
}

module.exports = { generar };
