const ApiError = require('../utils/ApiError');
const catalogo = require('../services/reportes/catalogo');
const balanceGeneral = require('../services/reportes/balance.service');

const MESES_POR_DEFECTO = 11;

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function vacio(valor) {
  return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
}

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function primerDiaHaceMeses(cantidad) {
  const fecha = new Date();

  fecha.setUTCDate(1);
  fecha.setUTCMonth(fecha.getUTCMonth() - cantidad);

  return fecha.toISOString().slice(0, 10);
}

function esFecha(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }

  const fecha = new Date(`${valor}T00:00:00Z`);

  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

function leerFecha(valor, etiqueta, porDefecto) {
  if (vacio(valor)) {
    return porDefecto;
  }

  const fecha = texto(valor);

  if (!esFecha(fecha)) {
    throw ApiError.solicitudInvalida(`${etiqueta} tiene que tener el formato AAAA-MM-DD`, 'FECHA_INVALIDA');
  }

  return fecha;
}

function leerRango(consulta = {}) {
  const desde = leerFecha(consulta.desde, 'La fecha desde', primerDiaHaceMeses(MESES_POR_DEFECTO));
  const hasta = leerFecha(consulta.hasta, 'La fecha hasta', hoy());

  if (desde > hasta) {
    throw ApiError.solicitudInvalida('La fecha desde no puede ser posterior a la fecha hasta', 'RANGO_INVALIDO');
  }

  return { desde, hasta };
}

function responder(res, id, rango, datos) {
  const ficha = catalogo.buscar(id);

  res.json({
    ok: true,
    reporte: ficha.id,
    codigo: ficha.codigo,
    titulo: ficha.titulo,
    rango,
    tarjetas: datos.tarjetas,
    serie: datos.serie,
    indicadores: datos.indicadores,
    detalle: datos.detalle || null,
  });
}

async function listar(req, res) {
  res.json({ ok: true, reportes: catalogo.listar() });
}

async function balance(req, res) {
  const rango = leerRango(req.query);

  responder(res, 'balance', rango, await balanceGeneral.generar(rango));
}

module.exports = { leerRango, responder, listar, balance };
