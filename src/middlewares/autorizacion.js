const ApiError = require('../utils/ApiError');

// Control de acceso por rol, reutilizable: se le pasan los roles permitidos y
// devuelve el middleware ya armado para esa ruta. De esta forma no hay que
// escribir el "if" del rol adentro de cada controlador.
//   router.post('/internos', requiereAutenticacion, requiereRol('administrador'), controlador);
//   router.get('/cuotas',   requiereAutenticacion, requiereRol('administrador', 'contador'), controlador);
function requiereRol(...rolesPermitidos) {
  // flat() permite pasar los roles sueltos o como arreglo, lo que resulte más cómodo.
  const permitidos = rolesPermitidos.flat().map((rol) => String(rol).toLowerCase());

  return function verificarRol(req, res, next) {
    // Salvaguarda por si alguien olvida poner requiereAutenticacion antes.
    if (!req.usuario) {
      return next(ApiError.noAutenticado('Ruta protegida: falta iniciar sesión', 'SIN_SESION'));
    }

    if (!permitidos.includes(String(req.usuario.rol).toLowerCase())) {
      return next(ApiError.sinPermiso('No tenés permiso para realizar esta acción', 'SIN_PERMISO'));
    }

    next();
  };
}

module.exports = { requiereRol };
