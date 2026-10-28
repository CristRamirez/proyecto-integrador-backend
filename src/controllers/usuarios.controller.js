const bcrypt = require('bcryptjs');
const ApiError = require('../utils/ApiError');
const usuarios = require('../services/usuarios.service');
const roles = require('../services/roles.service');

const POR_PAGINA = 20;
const MAXIMO_POR_PAGINA = 100;
const MINIMO_NOMBRE_USUARIO = 3;
const MAXIMO_NOMBRE_USUARIO = 40;
const MAXIMO_NOMBRE_COMPLETO = 120;
const MAXIMO_EMAIL = 120;
const MINIMO_PASSWORD = 8;
const MAXIMO_PASSWORD = 72;
const COSTO_BCRYPT = 10;

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function vacio(valor) {
  return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
}

function leerId(valor) {
  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.solicitudInvalida('El id del usuario no es válido', 'ID_INVALIDO');
  }

  return id;
}

function leerNombreUsuario(valor) {
  const nombre = texto(valor).toLowerCase();

  if (!nombre) {
    throw ApiError.solicitudInvalida('El nombre de usuario es obligatorio', 'DATOS_INCOMPLETOS');
  }

  if (nombre.length < MINIMO_NOMBRE_USUARIO || nombre.length > MAXIMO_NOMBRE_USUARIO) {
    throw ApiError.solicitudInvalida(
      `El nombre de usuario tiene que tener entre ${MINIMO_NOMBRE_USUARIO} y ${MAXIMO_NOMBRE_USUARIO} caracteres`,
      'NOMBRE_USUARIO_INVALIDO'
    );
  }

  if (!/^[a-z0-9._-]+$/.test(nombre)) {
    throw ApiError.solicitudInvalida(
      'El nombre de usuario solo acepta letras sin acento, números, punto, guion y guion bajo',
      'NOMBRE_USUARIO_INVALIDO'
    );
  }

  return nombre;
}

function leerNombreCompleto(valor) {
  const nombre = texto(valor);

  if (!nombre) {
    throw ApiError.solicitudInvalida('El nombre y apellido es obligatorio', 'DATOS_INCOMPLETOS');
  }

  if (nombre.length > MAXIMO_NOMBRE_COMPLETO) {
    throw ApiError.solicitudInvalida(
      `El nombre y apellido no puede superar los ${MAXIMO_NOMBRE_COMPLETO} caracteres`,
      'NOMBRE_INVALIDO'
    );
  }

  return nombre;
}

function leerEmail(valor) {
  if (vacio(valor)) {
    return null;
  }

  const email = texto(valor).toLowerCase();

  if (email.length > MAXIMO_EMAIL) {
    throw ApiError.solicitudInvalida(`El email no puede superar los ${MAXIMO_EMAIL} caracteres`, 'EMAIL_INVALIDO');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw ApiError.solicitudInvalida('El email no tiene un formato válido', 'EMAIL_INVALIDO');
  }

  return email;
}

function leerPassword(valor) {
  if (vacio(valor)) {
    throw ApiError.solicitudInvalida('La contraseña es obligatoria', 'DATOS_INCOMPLETOS');
  }

  const password = String(valor);

  if (password.length < MINIMO_PASSWORD || password.length > MAXIMO_PASSWORD) {
    throw ApiError.solicitudInvalida(
      `La contraseña tiene que tener entre ${MINIMO_PASSWORD} y ${MAXIMO_PASSWORD} caracteres`,
      'PASSWORD_INVALIDA'
    );
  }

  return password;
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

function leerFiltroActivo(valor) {
  return vacio(valor) ? null : leerActivo(valor);
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

async function leerRol(valor) {
  if (vacio(valor)) {
    throw ApiError.solicitudInvalida('El rol es obligatorio', 'DATOS_INCOMPLETOS');
  }

  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.solicitudInvalida('El id del rol no es válido', 'ID_INVALIDO');
  }

  const rol = await roles.obtenerPorId(id);

  if (!rol) {
    throw ApiError.solicitudInvalida('El rol no existe', 'ROL_INEXISTENTE');
  }

  return rol;
}

async function buscarOFallar(id) {
  const usuario = await usuarios.obtener(id);

  if (!usuario) {
    throw ApiError.noEncontrado('El usuario no existe', 'USUARIO_NO_ENCONTRADO');
  }

  return usuario;
}

async function controlarNombreUsuarioLibre(nombreUsuario, idPropio = null) {
  const repetido = await usuarios.buscarPorNombreUsuario(nombreUsuario);

  if (repetido && repetido.id !== idPropio) {
    throw new ApiError(409, 'Ya hay un usuario con ese nombre de usuario', 'USUARIO_DUPLICADO');
  }
}

async function controlarEmailLibre(email, idPropio = null) {
  if (!email) {
    return;
  }

  const repetido = await usuarios.buscarPorEmail(email);

  if (repetido && repetido.id !== idPropio) {
    throw new ApiError(409, 'Ya hay un usuario con ese email', 'EMAIL_DUPLICADO');
  }
}

function esAdministrador(rol) {
  return String(rol).toLowerCase() === usuarios.ROL_ADMINISTRADOR;
}

async function controlarQueQuedeUnAdministrador(usuario) {
  if (!esAdministrador(usuario.rol) || !usuario.activo) {
    return;
  }

  if ((await usuarios.contarAdministradoresActivos()) <= 1) {
    throw new ApiError(
      409,
      'Es el único administrador activo: primero habilitá o designá otro administrador',
      'ULTIMO_ADMINISTRADOR'
    );
  }
}

function presentar(usuario) {
  return { ...usuario, bloqueado: usuarios.estaBloqueado(usuario) };
}

async function listar(req, res) {
  const consulta = req.query;
  const pagina = leerPaginado(consulta.pagina, 1, 'La página');
  const porPagina = Math.min(leerPaginado(consulta.por_pagina, POR_PAGINA, 'La cantidad por página'), MAXIMO_POR_PAGINA);
  const rolId = vacio(consulta.rol_id) ? null : (await leerRol(consulta.rol_id)).id;

  const { usuarios: encontrados, total } = await usuarios.listar({
    texto: texto(consulta.q) || null,
    rolId,
    activo: leerFiltroActivo(consulta.activo),
    pagina,
    porPagina,
  });

  res.json({
    ok: true,
    usuarios: encontrados.map(presentar),
    paginacion: {
      pagina,
      por_pagina: porPagina,
      total,
      total_paginas: Math.ceil(total / porPagina),
    },
  });
}

async function obtener(req, res) {
  const usuario = await buscarOFallar(leerId(req.params.id));

  res.json({ ok: true, usuario: presentar(usuario) });
}

async function crear(req, res) {
  const cuerpo = req.body || {};
  const nombreUsuario = leerNombreUsuario(cuerpo.nombre_usuario);
  const nombreCompleto = leerNombreCompleto(cuerpo.nombre_completo);
  const email = leerEmail(cuerpo.email);
  const password = leerPassword(cuerpo.password);
  const rol = await leerRol(cuerpo.rol_id);

  await controlarNombreUsuarioLibre(nombreUsuario);
  await controlarEmailLibre(email);

  const id = await usuarios.crear({
    nombreUsuario,
    nombreCompleto,
    email,
    passwordHash: await bcrypt.hash(password, COSTO_BCRYPT),
    rolId: rol.id,
  });

  res.status(201).json({ ok: true, usuario: presentar(await usuarios.obtener(id)) });
}

async function actualizar(req, res) {
  const id = leerId(req.params.id);
  const cuerpo = req.body || {};
  const actual = await buscarOFallar(id);
  const nombreUsuario = leerNombreUsuario(cuerpo.nombre_usuario);
  const nombreCompleto = leerNombreCompleto(cuerpo.nombre_completo);
  const email = leerEmail(cuerpo.email);
  const rol = await leerRol(cuerpo.rol_id);

  await controlarNombreUsuarioLibre(nombreUsuario, id);
  await controlarEmailLibre(email, id);

  if (!esAdministrador(rol.nombre)) {
    await controlarQueQuedeUnAdministrador(actual);
  }

  await usuarios.actualizar(id, { nombreUsuario, nombreCompleto, email, rolId: rol.id });

  res.json({ ok: true, usuario: presentar(await usuarios.obtener(id)) });
}

async function cambiarPassword(req, res) {
  const id = leerId(req.params.id);
  const password = leerPassword((req.body || {}).password);

  await buscarOFallar(id);
  await usuarios.cambiarPassword(id, await bcrypt.hash(password, COSTO_BCRYPT));

  res.json({ ok: true, usuario: presentar(await usuarios.obtener(id)) });
}

async function cambiarEstado(req, res) {
  const id = leerId(req.params.id);
  const activo = leerActivo((req.body || {}).activo);
  const actual = await buscarOFallar(id);

  if (!activo) {
    if (id === Number(req.usuario.id)) {
      throw new ApiError(409, 'No podés deshabilitar tu propio usuario', 'USUARIO_ES_PROPIO');
    }

    await controlarQueQuedeUnAdministrador(actual);
  }

  await usuarios.cambiarActivo(id, activo);

  res.json({ ok: true, usuario: presentar(await usuarios.obtener(id)) });
}

async function desbloquear(req, res) {
  const id = leerId(req.params.id);

  await buscarOFallar(id);
  await usuarios.reiniciarIntentos(id);

  res.json({ ok: true, usuario: presentar(await usuarios.obtener(id)) });
}

module.exports = { listar, obtener, crear, actualizar, cambiarPassword, cambiarEstado, desbloquear };
