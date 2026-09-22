const catalogos = require('../services/catalogos.service');

// GET /api/estados
async function listarEstados(req, res) {
  res.json({ ok: true, estados: await catalogos.listarEstados() });
}

// GET /api/obras-sociales
async function listarObrasSociales(req, res) {
  res.json({ ok: true, obrasSociales: await catalogos.listarObrasSociales() });
}

module.exports = { listarEstados, listarObrasSociales };
