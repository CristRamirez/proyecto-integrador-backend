const ApiError = require('../utils/ApiError');
const egresos = require('../services/egresos.service');
const catalogos = require('../services/catalogos.service');

const ANIO_MINIMO = 2020;
const ANIO_MAXIMO = 2100;
const POR_PAGINA = 20;
const MAXIMO_POR_PAGINA = 100;
const MAXIMO_CONCEPTO = 200;
const MAXIMO_CATEGORIA = 60;
const MAXIMO_COMPROBANTE = 100;
const MAXIMO_OBSERVACIONES = 500;

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function vacio(valor) {
  return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
}

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function esFecha(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }

  const fecha = new Date(`${valor}T00:00:00Z`);

  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

function leerEntero(valor, etiqueta, minimo, maximo, codigo) {
  if (vacio(valor)) {
    throw ApiError.solicitudInvalida(`${etiqueta} es obligatorio`, 'DATOS_INCOMPLETOS');
  }

  const numero = Number(valor);

  if (!Number.isInteger(numero) || numero < minimo || numero > maximo) {
    throw ApiError.solicitudInvalida(`${etiqueta} tiene que ser un número entero entre ${minimo} y ${maximo}`, codigo);
  }

  return numero;
}

function leerTexto(valor, etiqueta, maximo, codigo, { obligatorio = true, faltante } = {}) {
  const contenido = texto(valor);

  if (!contenido) {
    if (obligatorio) {
      throw ApiError.solicitudInvalida(faltante || `${etiqueta} es obligatorio`, 'DATOS_INCOMPLETOS');
    }

    return null;
  }

  if (contenido.length > maximo) {
    throw ApiError.solicitudInvalida(`${etiqueta} no puede superar los ${maximo} caracteres`, codigo);
  }

  return contenido;
}

function leerCategoria(valor) {
  const categoria = leerTexto(valor, 'La categoría', MAXIMO_CATEGORIA, 'CATEGORIA_INVALIDA', {
    faltante: 'La categoría es obligatoria',
  });

  return categoria.toLowerCase();
}

function leerMonto(valor) {
  if (vacio(valor)) {
    throw ApiError.solicitudInvalida('El monto es obligatorio', 'DATOS_INCOMPLETOS');
  }

  const monto = Number(valor);

  if (!Number.isFinite(monto) || monto <= 0) {
    throw ApiError.solicitudInvalida('El monto tiene que ser un número mayor a cero', 'MONTO_INVALIDO');
  }

  return Math.round(monto * 100) / 100;
}

function leerFecha(valor) {
  if (vacio(valor)) {
    return hoy();
  }

  const fecha = texto(valor);

  if (!esFecha(fecha)) {
    throw ApiError.solicitudInvalida('La fecha tiene que tener el formato AAAA-MM-DD', 'FECHA_INVALIDA');
  }

  if (fecha > hoy()) {
    throw ApiError.solicitudInvalida('La fecha no puede ser futura', 'FECHA_INVALIDA');
  }

  return fecha;
}

async function leerMedioPago(valor) {
  const id = leerEntero(valor, 'El medio de pago', 1, Number.MAX_SAFE_INTEGER, 'ID_INVALIDO');
  const medioPago = await catalogos.buscarMedioPago(id);

  if (!medioPago) {
    throw ApiError.solicitudInvalida('El medio de pago no existe', 'MEDIO_PAGO_INEXISTENTE');
  }

  return medioPago.id;
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

async function registrar(req, res) {
  const cuerpo = req.body || {};

  const datos = {
    concepto: leerTexto(cuerpo.concepto, 'El concepto', MAXIMO_CONCEPTO, 'CONCEPTO_INVALIDO'),
    categoria: leerCategoria(cuerpo.categoria),
    monto: leerMonto(cuerpo.monto),
    fecha: leerFecha(cuerpo.fecha),
    comprobante: leerTexto(cuerpo.comprobante, 'El comprobante', MAXIMO_COMPROBANTE, 'COMPROBANTE_INVALIDO', {
      obligatorio: false,
    }),
    observaciones: leerTexto(cuerpo.observaciones, 'Las observaciones', MAXIMO_OBSERVACIONES, 'OBSERVACIONES_INVALIDAS', {
      obligatorio: false,
    }),
    medioPagoId: await leerMedioPago(cuerpo.medio_pago_id),
    usuarioId: req.usuario.id,
  };

  const id = await egresos.crear(datos);

  res.status(201).json({ ok: true, egreso: await egresos.obtener(id) });
}

async function listar(req, res) {
  const consulta = req.query;
  const anio = leerEntero(consulta.anio, 'El año', ANIO_MINIMO, ANIO_MAXIMO, 'PERIODO_INVALIDO');
  const mes = leerEntero(consulta.mes, 'El mes', 1, 12, 'PERIODO_INVALIDO');
  const pagina = leerPaginado(consulta.pagina, 1, 'La página');
  const porPagina = Math.min(leerPaginado(consulta.por_pagina, POR_PAGINA, 'La cantidad por página'), MAXIMO_POR_PAGINA);

  const { egresos: encontrados, total } = await egresos.listarPeriodo({
    anio,
    mes,
    categoria: texto(consulta.categoria) || null,
    pagina,
    porPagina,
  });

  res.json({
    ok: true,
    periodo: { anio, mes },
    resumen: await egresos.resumenPeriodo(anio, mes),
    egresos: encontrados,
    paginacion: {
      pagina,
      por_pagina: porPagina,
      total,
      total_paginas: Math.ceil(total / porPagina),
    },
  });
}

async function categorias(req, res) {
  res.json({ ok: true, categorias: await egresos.categoriasUsadas() });
}

module.exports = { registrar, listar, categorias };
