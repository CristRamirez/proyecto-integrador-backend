const { sql } = require('drizzle-orm');

const FORMATOS = {
  MONEDA: 'moneda',
  PORCENTAJE: 'porcentaje',
  NUMERO: 'numero',
  TEXTO: 'texto',
};

function enRango(columna, desde, hasta) {
  return sql`substr(${columna}, 1, 10) BETWEEN ${desde} AND ${hasta}`;
}

function mesDe(columna) {
  return sql`substr(${columna}, 1, 7)`;
}

function suma(columna) {
  return sql`COALESCE(SUM(${columna}), 0)`.mapWith(Number);
}

function redondear(numero) {
  return Math.round((Number(numero) || 0) * 100) / 100;
}

function porcentaje(parte, total) {
  return total ? redondear((Number(parte) * 100) / Number(total)) : 0;
}

function clave(texto) {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function etiquetaDe(texto) {
  const limpio = String(texto).trim();

  return limpio ? limpio[0].toUpperCase() + limpio.slice(1) : limpio;
}

function tarjeta(clave, etiqueta, valor, formato = FORMATOS.MONEDA) {
  return { clave, etiqueta, valor: redondear(valor), formato };
}

function indicador(clave, etiqueta, valor, formato = FORMATOS.PORCENTAJE) {
  return { clave, etiqueta, valor: redondear(valor), formato };
}

function mesesDelRango(desde, hasta) {
  const meses = [];
  const [anioFin, mesFin] = hasta.slice(0, 7).split('-').map(Number);
  let [anio, mes] = desde.slice(0, 7).split('-').map(Number);

  while (anio < anioFin || (anio === anioFin && mes <= mesFin)) {
    meses.push(`${anio}-${String(mes).padStart(2, '0')}`);
    mes += 1;

    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }

  return meses;
}

function valoresPorMes(filas, meses, campo = 'total') {
  const porMes = new Map(filas.map((fila) => [fila.mes, fila[campo]]));

  return meses.map((mes) => redondear(porMes.get(mes) || 0));
}

function linea(clave, etiqueta, valores) {
  return { clave, etiqueta, valores };
}

function serie(etiquetas, lineas) {
  return { etiquetas, lineas };
}

function tabla(columnas, filas) {
  return { columnas, filas };
}

function columna(clave, etiqueta, formato = FORMATOS.TEXTO) {
  return { clave, etiqueta, formato };
}

module.exports = {
  FORMATOS,
  enRango,
  mesDe,
  suma,
  redondear,
  porcentaje,
  clave,
  etiquetaDe,
  tarjeta,
  indicador,
  mesesDelRango,
  valoresPorMes,
  linea,
  serie,
  tabla,
  columna,
};
