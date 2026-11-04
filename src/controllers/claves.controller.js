const ApiError = require('../utils/ApiError');
const claves = require('../services/claves.service');
const auditoria = require('../services/auditoria.service');

const { ACCIONES } = auditoria;

const ENTIDAD = 'claves_integracion';
const MAXIMO_SERVICIO = 60;
const MAXIMO_DESCRIPCION = 200;
const MINIMO_VALOR = 8;
const MAXIMO_VALOR = 500;

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function vacio(valor) {
  return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
}

function leerId(valor) {
  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.solicitudInvalida('El id de la clave no es válido', 'ID_INVALIDO');
  }

  return id;
}

function leerServicio(valor) {
  const servicio = texto(valor).toLowerCase();

  if (!servicio) {
    throw ApiError.solicitudInvalida('El servicio es obligatorio', 'DATOS_INCOMPLETOS');
  }

  if (servicio.length > MAXIMO_SERVICIO) {
    throw ApiError.solicitudInvalida(
      `El servicio no puede superar los ${MAXIMO_SERVICIO} caracteres`,
      'SERVICIO_INVALIDO'
    );
  }

  return servicio;
}

function leerDescripcion(valor) {
  if (vacio(valor)) {
    return null;
  }

  const descripcion = texto(valor);

  if (descripcion.length > MAXIMO_DESCRIPCION) {
    throw ApiError.solicitudInvalida(
      `La descripción no puede superar los ${MAXIMO_DESCRIPCION} caracteres`,
      'DESCRIPCION_INVALIDA'
    );
  }

  return descripcion;
}

function leerValor(valor, { obligatorio = true } = {}) {
  if (vacio(valor)) {
    if (obligatorio) {
      throw ApiError.solicitudInvalida('La clave es obligatoria', 'DATOS_INCOMPLETOS');
    }

    return null;
  }

  const clave = texto(valor);

  if (clave.length < MINIMO_VALOR || clave.length > MAXIMO_VALOR) {
    throw ApiError.solicitudInvalida(
      `La clave tiene que tener entre ${MINIMO_VALOR} y ${MAXIMO_VALOR} caracteres`,
      'CLAVE_INVALIDA'
    );
  }

  return clave;
}

function leerActivo(valor) {
  if (valor === true || valor === 1 || valor === '1' || valor === 'true') {
    return true;
  }

  if (valor === false || valor === 0 || valor === '0' || valor === 'false') {
    return false;
  }

  throw ApiError.solicitudInvalida('El campo activo solo acepta true o false', 'DATOS_INVALIDOS');
}

async function buscarOFallar(id) {
  const clave = await claves.obtener(id);

  if (!clave) {
    throw ApiError.noEncontrado('La clave no existe', 'CLAVE_NO_ENCONTRADA');
  }

  return clave;
}

async function controlarServicioLibre(servicio, idPropio = null) {
  const repetida = await claves.buscarPorServicio(servicio);

  if (repetida && repetida.id !== idPropio) {
    throw new ApiError(409, 'Ya hay una clave cargada para ese servicio', 'SERVICIO_DUPLICADO');
  }
}

async function listar(req, res) {
  res.json({ ok: true, claves: await claves.listar() });
}

async function obtener(req, res) {
  res.json({ ok: true, clave: await buscarOFallar(leerId(req.params.id)) });
}

async function crear(req, res) {
  const cuerpo = req.body || {};
  const servicio = leerServicio(cuerpo.servicio);
  const descripcion = leerDescripcion(cuerpo.descripcion);
  const valor = leerValor(cuerpo.valor);

  await controlarServicioLibre(servicio);

  const id = await claves.crear({ servicio, descripcion, valor, usuarioId: req.usuario.id });

  await auditoria.registrar(req.usuario.id, ACCIONES.ALTA, ENTIDAD, id, { servicio });

  res.status(201).json({ ok: true, clave: await claves.obtener(id) });
}

async function actualizar(req, res) {
  const id = leerId(req.params.id);
  const cuerpo = req.body || {};
  const actual = await buscarOFallar(id);
  const servicio = leerServicio(cuerpo.servicio);
  const descripcion = leerDescripcion(cuerpo.descripcion);
  const valor = leerValor(cuerpo.valor, { obligatorio: false });

  await controlarServicioLibre(servicio, id);
  await claves.actualizar(id, { servicio, descripcion, valor }, req.usuario.id);

  await auditoria.registrar(req.usuario.id, ACCIONES.MODIFICACION, ENTIDAD, id, {
    servicio,
    ...(actual.servicio !== servicio ? { servicio_anterior: actual.servicio } : {}),
    clave_cambiada: Boolean(valor),
  });

  res.json({ ok: true, clave: await claves.obtener(id) });
}

async function cambiarEstado(req, res) {
  const id = leerId(req.params.id);
  const activo = leerActivo((req.body || {}).activo);
  const actual = await buscarOFallar(id);

  await claves.cambiarActivo(id, activo, req.usuario.id);

  await auditoria.registrar(req.usuario.id, ACCIONES.MODIFICACION, ENTIDAD, id, {
    servicio: actual.servicio,
    activo,
  });

  res.json({ ok: true, clave: await claves.obtener(id) });
}

async function eliminar(req, res) {
  const id = leerId(req.params.id);
  const actual = await buscarOFallar(id);

  await claves.eliminar(id);

  await auditoria.registrar(req.usuario.id, ACCIONES.BAJA, ENTIDAD, id, {
    servicio: actual.servicio,
    eliminada: true,
  });

  res.status(204).end();
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado, eliminar };
