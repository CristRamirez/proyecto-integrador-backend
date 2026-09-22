const bcrypt = require('bcryptjs');
const ApiError = require('../utils/ApiError');
const { firmarToken } = require('../utils/token');
const usuarios = require('../services/usuarios.service');
const roles = require('../services/roles.service');

const MAXIMO_INTENTOS = 5;
const MINUTOS_BLOQUEO = 5;

function ahora() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function dentroDe(minutos) {
  return new Date(Date.now() + minutos * 60000).toISOString().slice(0, 19).replace('T', ' ');
}

function estaBloqueado(usuario) {
  return Boolean(usuario.bloqueado_hasta) && usuario.bloqueado_hasta > ahora();
}

function errorDeBloqueo(hasta) {
  const restante = new Date(`${hasta.replace(' ', 'T')}Z`).getTime() - Date.now();
  const minutos = Math.max(1, Math.ceil(restante / 60000));

  return new ApiError(
    423,
    `El usuario está bloqueado por intentos fallidos, probá de nuevo en ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`,
    'USUARIO_BLOQUEADO'
  );
}

async function registrarIntentoFallido(usuario) {
  const previos = usuario.bloqueado_hasta ? 0 : usuario.intentos_fallidos;
  const intentos = previos + 1;

  if (intentos >= MAXIMO_INTENTOS) {
    const hasta = dentroDe(MINUTOS_BLOQUEO);

    await usuarios.actualizarIntentos(usuario.id, intentos, hasta);

    throw errorDeBloqueo(hasta);
  }

  await usuarios.actualizarIntentos(usuario.id, intentos, null);
}

// POST /api/auth/login
async function login(req, res) {
  const { nombre_usuario: nombreUsuario, password } = req.body || {};

  if (!nombreUsuario || !password) {
    throw ApiError.solicitudInvalida('Faltan el usuario y/o la contraseña', 'DATOS_INCOMPLETOS');
  }

  const usuario = await usuarios.buscarPorNombreUsuario(nombreUsuario);

  if (usuario && estaBloqueado(usuario)) {
    throw errorDeBloqueo(usuario.bloqueado_hasta);
  }

  // La contraseña se guarda hasheada: no se compara con ===, se usa bcrypt.compare,
  // que vuelve a hashear lo que escribió el usuario y lo contrasta con el hash.
  const claveCorrecta = usuario ? await bcrypt.compare(password, usuario.password_hash) : false;

  // Mismo mensaje si el usuario no existe o si la contraseña está mal: así no se
  // informa cuál de los dos campos falló y no se puede averiguar qué usuarios existen.
  if (!usuario || !claveCorrecta) {
    if (usuario) {
      await registrarIntentoFallido(usuario);
    }

    throw ApiError.noAutenticado('Usuario o contraseña incorrectos', 'CREDENCIALES_INVALIDAS');
  }

  if (!usuario.activo) {
    throw ApiError.sinPermiso('El usuario está deshabilitado', 'USUARIO_INACTIVO');
  }

  if (usuario.intentos_fallidos > 0 || usuario.bloqueado_hasta) {
    await usuarios.reiniciarIntentos(usuario.id);
  }

  res.json({
    ok: true,
    token: firmarToken(usuario),
    usuario: {
      id: usuario.id,
      nombreUsuario: usuario.nombre_usuario,
      nombreCompleto: usuario.nombre_completo,
      rol: usuario.rol,
      modulos: await roles.nombresDeModulosDelRol(usuario.rol),
    },
  });
}

// GET /api/auth/yo
// Devuelve de quién es el token que se mandó. Le sirve a la app de escritorio para
// saber si la sesión sigue viva y qué opciones del menú mostrar.
async function yo(req, res) {
  const modulos = await roles.nombresDeModulosDelRol(req.usuario.rol);

  res.json({ ok: true, usuario: { ...req.usuario, modulos } });
}

module.exports = { login, yo };
