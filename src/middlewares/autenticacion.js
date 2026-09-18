const { verificarToken } = require('../utils/token');
const ApiError = require('../utils/ApiError');

// Protege una ruta: exige el encabezado  Authorization: Bearer <token>.
// Si el token es válido deja los datos del usuario en req.usuario, así los
// controladores y el control por rol los tienen listos sin volver a la base.
//   router.get('/ruta', requiereAutenticacion, controlador);
function requiereAutenticacion(req, res, next) {
  const cabecera = req.headers.authorization || '';
  const [esquema, token] = cabecera.split(' ');

  if (esquema !== 'Bearer' || !token) {
    return next(ApiError.noAutenticado('Falta el token de acceso', 'TOKEN_FALTANTE'));
  }

  // Si el token no sirve, verificarToken lanza el error y Express lo lleva
  // solo hasta el manejador central.
  const datos = verificarToken(token);

  req.usuario = {
    id: datos.sub,
    nombreUsuario: datos.usuario,
    rol: datos.rol,
  };

  next();
}

module.exports = { requiereAutenticacion };
