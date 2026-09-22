const ApiError = require('../utils/ApiError');
const roles = require('../services/roles.service');
const modulos = require('../services/modulos.service');

function leerId(valor) {
  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.solicitudInvalida('El id del rol no es válido', 'ID_INVALIDO');
  }

  return id;
}

async function buscarOFallar(id) {
  const rol = await roles.obtenerPorId(id);

  if (!rol) {
    throw ApiError.noEncontrado('El rol no existe', 'ROL_NO_ENCONTRADO');
  }

  return rol;
}

function leerListaDeModulos(cuerpo) {
  const lista = (cuerpo || {}).modulos;

  if (!Array.isArray(lista)) {
    throw ApiError.solicitudInvalida('Hay que enviar la lista de módulos del rol', 'DATOS_INCOMPLETOS');
  }

  const ids = [...new Set(lista.map(Number))];

  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw ApiError.solicitudInvalida('La lista de módulos tiene valores inválidos', 'ID_INVALIDO');
  }

  return ids;
}

async function listar(req, res) {
  res.json({ ok: true, roles: await roles.listar() });
}

async function listarModulos(req, res) {
  const id = leerId(req.params.id);
  const rol = await buscarOFallar(id);

  res.json({ ok: true, rol: rol.nombre, modulos: await roles.modulosDeRol(id) });
}

async function reemplazarModulos(req, res) {
  const id = leerId(req.params.id);
  const rol = await buscarOFallar(id);
  const ids = leerListaDeModulos(req.body);

  for (const moduloId of ids) {
    if (!(await modulos.obtenerPorId(moduloId))) {
      throw ApiError.solicitudInvalida(`El módulo ${moduloId} no existe`, 'MODULO_INEXISTENTE');
    }
  }

  res.json({ ok: true, rol: rol.nombre, modulos: await roles.reemplazarModulos(id, ids) });
}

module.exports = { listar, listarModulos, reemplazarModulos };
