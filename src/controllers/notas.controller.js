const ApiError = require('../utils/ApiError');
const notas = require('../services/notas.service');
const internos = require('../services/internos.service');
const auditoria = require('../services/auditoria.service');

const { ACCIONES } = auditoria;
const MAXIMO_TEXTO = 1000;

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function leerId(valor, etiqueta) {
  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.solicitudInvalida(`El id ${etiqueta} no es válido`, 'ID_INVALIDO');
  }

  return id;
}

function leerTexto(valor) {
  const contenido = texto(valor);

  if (!contenido) {
    throw ApiError.solicitudInvalida('El texto de la nota es obligatorio', 'DATOS_INCOMPLETOS');
  }

  if (contenido.length > MAXIMO_TEXTO) {
    throw ApiError.solicitudInvalida(
      `La nota no puede superar los ${MAXIMO_TEXTO} caracteres`,
      'TEXTO_INVALIDO'
    );
  }

  return contenido;
}

async function internoOFallar(internoId) {
  const interno = await internos.obtenerFichaBasica(internoId);

  if (!interno) {
    throw ApiError.noEncontrado('El interno no existe', 'INTERNO_NO_ENCONTRADO');
  }

  return interno;
}

async function notaOFallar(internoId, notaId) {
  const nota = await notas.obtener(notaId);

  if (!nota || nota.interno_id !== internoId) {
    throw ApiError.noEncontrado('La nota no existe', 'NOTA_NO_ENCONTRADA');
  }

  return nota;
}

async function listar(req, res) {
  const internoId = leerId(req.params.id, 'del interno');

  await internoOFallar(internoId);

  res.json({ ok: true, notas: await notas.listarPorInterno(internoId) });
}

async function crear(req, res) {
  const internoId = leerId(req.params.id, 'del interno');
  const contenido = leerTexto((req.body || {}).texto);

  await internoOFallar(internoId);

  const notaId = await notas.crear(internoId, contenido, req.usuario.id);

  await auditoria.registrar(req.usuario.id, ACCIONES.ALTA, 'notas', notaId, {
    interno_id: internoId,
    texto: contenido,
  });

  res.status(201).json({ ok: true, nota: await notas.obtener(notaId) });
}

async function modificar(req, res) {
  const internoId = leerId(req.params.id, 'del interno');
  const notaId = leerId(req.params.notaId, 'de la nota');
  const contenido = leerTexto((req.body || {}).texto);

  await internoOFallar(internoId);

  const anterior = await notaOFallar(internoId, notaId);

  await notas.actualizar(notaId, contenido, req.usuario.id);

  await auditoria.registrar(req.usuario.id, ACCIONES.MODIFICACION, 'notas', notaId, {
    interno_id: internoId,
    cambios: { texto: { antes: anterior.texto, despues: contenido } },
  });

  res.json({ ok: true, nota: await notas.obtener(notaId) });
}

async function eliminar(req, res) {
  const internoId = leerId(req.params.id, 'del interno');
  const notaId = leerId(req.params.notaId, 'de la nota');

  await internoOFallar(internoId);

  const nota = await notaOFallar(internoId, notaId);

  await notas.eliminar(notaId);

  await auditoria.registrar(req.usuario.id, ACCIONES.BAJA, 'notas', notaId, {
    interno_id: internoId,
    texto: nota.texto,
  });

  res.status(204).end();
}

module.exports = { listar, crear, modificar, eliminar };
