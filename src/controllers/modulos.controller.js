const ApiError = require('../utils/ApiError');
const modulos = require('../services/modulos.service');

function leerNombre(valor) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw ApiError.solicitudInvalida('El nombre del módulo es obligatorio', 'DATOS_INCOMPLETOS');
  }

  const nombre = valor.trim().toLowerCase();

  if (nombre.length > 40) {
    throw ApiError.solicitudInvalida('El nombre del módulo no puede superar los 40 caracteres', 'NOMBRE_INVALIDO');
  }

  return nombre;
}

function leerId(valor) {
  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.solicitudInvalida('El id del módulo no es válido', 'ID_INVALIDO');
  }

  return id;
}

async function buscarOFallar(id) {
  const modulo = await modulos.obtenerPorId(id);

  if (!modulo) {
    throw ApiError.noEncontrado('El módulo no existe', 'MODULO_NO_ENCONTRADO');
  }

  return modulo;
}

async function listar(req, res) {
  res.json({ ok: true, modulos: await modulos.listar() });
}

async function crear(req, res) {
  const nombre = leerNombre((req.body || {}).nombre);

  if (await modulos.buscarPorNombre(nombre)) {
    throw new ApiError(409, 'Ya existe un módulo con ese nombre', 'MODULO_DUPLICADO');
  }

  res.status(201).json({ ok: true, modulo: await modulos.crear(nombre) });
}

async function actualizar(req, res) {
  const id = leerId(req.params.id);
  const nombre = leerNombre((req.body || {}).nombre);

  await buscarOFallar(id);

  const repetido = await modulos.buscarPorNombre(nombre);

  if (repetido && repetido.id !== id) {
    throw new ApiError(409, 'Ya existe un módulo con ese nombre', 'MODULO_DUPLICADO');
  }

  res.json({ ok: true, modulo: await modulos.actualizar(id, nombre) });
}

async function eliminar(req, res) {
  const id = leerId(req.params.id);

  await buscarOFallar(id);

  if (await modulos.estaAsignado(id)) {
    throw new ApiError(409, 'El módulo está asignado a un rol y no se puede eliminar', 'MODULO_EN_USO');
  }

  await modulos.eliminar(id);
  res.status(204).end();
}

module.exports = { listar, crear, actualizar, eliminar };
