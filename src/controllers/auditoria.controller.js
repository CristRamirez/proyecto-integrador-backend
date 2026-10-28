const ApiError = require('../utils/ApiError');
const auditoria = require('../services/auditoria.service');

const POR_PAGINA = 50;
const MAXIMO_POR_PAGINA = 200;

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function vacio(valor) {
  return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
}

function esFecha(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }

  const fecha = new Date(`${valor}T00:00:00Z`);

  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

function leerUsuario(valor) {
  if (vacio(valor)) {
    return null;
  }

  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.solicitudInvalida('El usuario tiene que ser un id entero mayor a cero', 'ID_INVALIDO');
  }

  return id;
}

function leerFecha(valor, etiqueta) {
  if (vacio(valor)) {
    return null;
  }

  const fecha = texto(valor);

  if (!esFecha(fecha)) {
    throw ApiError.solicitudInvalida(`${etiqueta} tiene que tener el formato AAAA-MM-DD`, 'FECHA_INVALIDA');
  }

  return fecha;
}

function leerPaginado(valor, porDefecto, etiqueta) {
  if (vacio(valor)) {
    return porDefecto;
  }

  const numero = Number(valor);

  if (!Number.isInteger(numero) || numero <= 0) {
    throw ApiError.solicitudInvalida(`${etiqueta} tiene que ser un número entero mayor a cero`, 'PAGINACION_INVALIDA');
  }

  return numero;
}

// GET /api/auditoria
// El registro de lo que hizo cada usuario, del más nuevo al más viejo. Todos los
// filtros son opcionales y se combinan entre sí.
async function listar(req, res) {
  const consulta = req.query;
  const desde = leerFecha(consulta.desde, 'La fecha desde');
  const hasta = leerFecha(consulta.hasta, 'La fecha hasta');

  if (desde && hasta && desde > hasta) {
    throw ApiError.solicitudInvalida('La fecha desde no puede ser posterior a la fecha hasta', 'FECHA_INVALIDA');
  }

  const pagina = leerPaginado(consulta.pagina, 1, 'La página');
  const porPagina = Math.min(leerPaginado(consulta.por_pagina, POR_PAGINA, 'La cantidad por página'), MAXIMO_POR_PAGINA);

  const { registros, total } = await auditoria.listar({
    usuarioId: leerUsuario(consulta.usuario_id),
    accion: texto(consulta.accion).toLowerCase() || null,
    entidad: texto(consulta.entidad).toLowerCase() || null,
    desde,
    hasta,
    pagina,
    porPagina,
  });

  res.json({
    ok: true,
    registros,
    paginacion: {
      pagina,
      por_pagina: porPagina,
      total,
      total_paginas: Math.ceil(total / porPagina),
    },
  });
}

// GET /api/auditoria/filtros
async function filtros(req, res) {
  res.json({ ok: true, ...(await auditoria.opcionesDeFiltro()) });
}

module.exports = { listar, filtros };
