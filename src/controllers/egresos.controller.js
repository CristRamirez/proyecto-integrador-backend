const ApiError = require('../utils/ApiError');
const egresos = require('../services/egresos.service');
const catalogos = require('../services/catalogos.service');
const auditoria = require('../services/auditoria.service');

const { ACCIONES } = auditoria;

const ANIO_MINIMO = 2020;
const ANIO_MAXIMO = 2100;
const POR_PAGINA = 20;
const MAXIMO_POR_PAGINA = 100;
const MAXIMO_CONCEPTO = 200;
const MAXIMO_CATEGORIA = 60;
const MAXIMO_COMPROBANTE = 100;
const MAXIMO_OBSERVACIONES = 500;
const MAXIMO_MOTIVO = 500;

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

function leerFecha(valor, porDefecto = hoy()) {
  if (vacio(valor)) {
    return porDefecto;
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

function leerIdEgreso(valor) {
  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.solicitudInvalida('El id del egreso no es válido', 'ID_INVALIDO');
  }

  return id;
}

// Los campos del alta y de la edición son los mismos y se validan igual.
// Lo único que cambia es la fecha que se usa si no viene.
async function leerDatos(cuerpo, fechaPorDefecto) {
  return {
    concepto: leerTexto(cuerpo.concepto, 'El concepto', MAXIMO_CONCEPTO, 'CONCEPTO_INVALIDO'),
    categoria: leerCategoria(cuerpo.categoria),
    monto: leerMonto(cuerpo.monto),
    fecha: leerFecha(cuerpo.fecha, fechaPorDefecto),
    comprobante: leerTexto(cuerpo.comprobante, 'El comprobante', MAXIMO_COMPROBANTE, 'COMPROBANTE_INVALIDO', {
      obligatorio: false,
    }),
    observaciones: leerTexto(cuerpo.observaciones, 'Las observaciones', MAXIMO_OBSERVACIONES, 'OBSERVACIONES_INVALIDAS', {
      obligatorio: false,
    }),
    medioPagoId: await leerMedioPago(cuerpo.medio_pago_id),
  };
}

function controlarNoAnulado(egreso) {
  if (egreso.estado === egresos.ESTADO_ANULADO) {
    throw new ApiError(409, 'El egreso está anulado', 'EGRESO_ANULADO');
  }
}

async function registrar(req, res) {
  const datos = await leerDatos(req.body || {}, hoy());
  const id = await egresos.crear({ ...datos, usuarioId: req.usuario.id });

  await auditoria.registrar(req.usuario.id, ACCIONES.ALTA, 'egresos', id, {
    concepto: datos.concepto,
    categoria: datos.categoria,
    monto: datos.monto,
    fecha: datos.fecha,
  });

  res.status(201).json({ ok: true, egreso: await egresos.obtener(id) });
}

// PUT /api/egresos/:id
// Se manda el egreso completo, igual que en el alta. Si no viene la fecha se
// deja la que tenía (en el alta sería la del día).
async function modificar(req, res) {
  const id = leerIdEgreso(req.params.id);
  const actual = await egresos.obtener(id);

  if (!actual) {
    throw ApiError.noEncontrado('El egreso no existe', 'EGRESO_NO_ENCONTRADO');
  }

  controlarNoAnulado(actual);

  const datos = await leerDatos(req.body || {}, String(actual.fecha).slice(0, 10));

  if (!(await egresos.actualizar(id, datos, req.usuario.id))) {
    throw new ApiError(409, 'El egreso está anulado', 'EGRESO_ANULADO');
  }

  await auditoria.registrar(req.usuario.id, ACCIONES.MODIFICACION, 'egresos', id, {
    cambios: auditoria.cambios(
      { ...actual, fecha: String(actual.fecha).slice(0, 10) },
      {
        concepto: datos.concepto,
        categoria: datos.categoria,
        monto: datos.monto,
        fecha: datos.fecha,
        comprobante: datos.comprobante,
        observaciones: datos.observaciones,
        medio_pago_id: datos.medioPagoId,
      }
    ),
  });

  res.json({ ok: true, egreso: await egresos.obtener(id) });
}

function leerMotivo(valor) {
  const motivo = texto(valor);

  if (!motivo) {
    throw ApiError.solicitudInvalida('El motivo de la anulación es obligatorio', 'DATOS_INCOMPLETOS');
  }

  if (motivo.length > MAXIMO_MOTIVO) {
    throw ApiError.solicitudInvalida(
      `El motivo no puede superar los ${MAXIMO_MOTIVO} caracteres`,
      'MOTIVO_INVALIDO'
    );
  }

  return motivo;
}

// POST /api/egresos/:id/anular
// No se borra: queda en el listado con estado 'anulado' y el motivo, y deja de
// sumar en el resumen. Igual que las cuotas anuladas o la baja de un interno.
async function anular(req, res) {
  const id = leerIdEgreso(req.params.id);
  const actual = await egresos.obtener(id);

  if (!actual) {
    throw ApiError.noEncontrado('El egreso no existe', 'EGRESO_NO_ENCONTRADO');
  }

  if (actual.estado === egresos.ESTADO_ANULADO) {
    throw new ApiError(409, 'El egreso ya está anulado', 'EGRESO_YA_ANULADO');
  }

  const motivo = leerMotivo((req.body || {}).motivo);

  if (!(await egresos.anular(id, motivo, req.usuario.id))) {
    throw new ApiError(409, 'El egreso ya está anulado', 'EGRESO_YA_ANULADO');
  }

  await auditoria.registrar(req.usuario.id, ACCIONES.ANULACION, 'egresos', id, {
    motivo,
    concepto: actual.concepto,
    monto: actual.monto,
  });

  res.json({ ok: true, egreso: await egresos.obtener(id) });
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

module.exports = { registrar, modificar, anular, listar, categorias };
