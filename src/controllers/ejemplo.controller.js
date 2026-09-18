// Rutas de ejemplo: no forman parte del sistema, muestran cómo se arma una ruta
// en cada uno de los tres casos (abierta, con token y con rol). Sirven de molde
// para los módulos que vienen y para probar la API sin datos cargados.

// GET /api/ejemplo/publico
function publico(req, res) {
  res.json({ ok: true, mensaje: 'Esta ruta no pide token' });
}

// GET /api/ejemplo/protegido
function protegido(req, res) {
  // req.usuario lo dejó el middleware de autenticación.
  res.json({ ok: true, mensaje: `Hola ${req.usuario.nombreUsuario}, tu token es válido` });
}

// GET /api/ejemplo/solo-admin
function soloAdmin(req, res) {
  res.json({ ok: true, mensaje: 'Entraste a una ruta reservada al rol administrador' });
}

// GET /api/ejemplo/error
// Fuerza un error no controlado a propósito, para comprobar que el manejador
// central lo atrapa y responde el mismo formato que el resto (sin mostrar el stack).
function romper() {
  throw new Error('Error de prueba lanzado a propósito');
}

module.exports = { publico, protegido, soloAdmin, romper };
