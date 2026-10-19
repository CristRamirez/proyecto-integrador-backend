const ApiError = require('../utils/ApiError');
const cuotas = require('../services/cuotas.service');
const parametros = require('../services/parametros.service');

const ESTADO_INICIAL = 'pendiente';
const ANIO_MINIMO = 2020;
const ANIO_MAXIMO = 2100;
const ESTADOS_DEL_FILTRO = ['pendiente', 'parcial', 'pagada', 'vencida', 'anulada'];
const POR_PAGINA = 20;
const MAXIMO_POR_PAGINA = 100;
const MAXIMO_PALABRAS = 5;

function vacio(valor) {
  return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
}

function leerEntero(valor, etiqueta, minimo, maximo, codigo) {
  if (vacio(valor)) {
    throw ApiError.solicitudInvalida(`${etiqueta} es obligatorio`, 'DATOS_INCOMPLETOS');
  }

  const numero = Number(valor);

  if (!Number.isInteger(numero) || numero < minimo || numero > maximo) {
    throw ApiError.solicitudInvalida(`${etiqueta} tiene que ser un número entero entre ${minimo} y ${maximo}`, codigo);
  }

  return numero;
}

function fechaDeVencimiento(anio, mes, dia) {
  const ultimoDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const diaReal = Math.min(dia, ultimoDelMes);

  return `${anio}-${String(mes).padStart(2, '0')}-${String(diaReal).padStart(2, '0')}`;
}

async function generar(req, res) {
  const cuerpo = req.body || {};
  const anio = leerEntero(cuerpo.anio, 'El año', ANIO_MINIMO, ANIO_MAXIMO, 'PERIODO_INVALIDO');
  const mes = leerEntero(cuerpo.mes, 'El mes', 1, 12, 'PERIODO_INVALIDO');

  const configuracion = await parametros.obtenerVigente();

  if (!configuracion) {
    throw new ApiError(
      409,
      'Todavía no se cargaron los parámetros de cobranza: no hay valor de cuota con el que generar',
      'SIN_PARAMETROS'
    );
  }

  const estado = await cuotas.buscarEstadoPorNombre(ESTADO_INICIAL);

  if (!estado) {
    throw new ApiError(500, 'Falta el estado pendiente en la base de datos', 'ESTADO_CUOTA_FALTANTE');
  }

  const activos = await cuotas.contarInternosActivos();
  const pendientes = await cuotas.internosActivosSinCuota(anio, mes);
  const fechaVencimiento = fechaDeVencimiento(anio, mes, configuracion.dia_vencimiento);

  for (const internoId of pendientes) {
    await cuotas.crear({
      internoId,
      configId: configuracion.id,
      estadoCuotaId: estado.id,
      anio,
      mes,
      valorBase: configuracion.valor_cuota,
      fechaVencimiento,
    });
  }

  res.json({
    ok: true,
    periodo: { anio, mes },
    valor_cuota: configuracion.valor_cuota,
    fecha_vencimiento: fechaVencimiento,
    internos_activos: activos,
    creadas: pendientes.length,
    omitidas: activos - pendientes.length,
  });
}

function leerEstado(valor) {
  const estado = typeof valor === 'string' ? valor.trim().toLowerCase() : '';

  if (!estado) {
    return null;
  }

  if (!ESTADOS_DEL_FILTRO.includes(estado)) {
    throw ApiError.solicitudInvalida('El estado no existe', 'ESTADO_INEXISTENTE');
  }

  return estado;
}

function leerPalabras(valor) {
  const texto = typeof valor === 'string' ? valor.trim() : '';

  return texto.split(/\s+/).filter(Boolean).slice(0, MAXIMO_PALABRAS);
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

function redondear(valor) {
  return Math.round(valor * 100) / 100;
}

async function listar(req, res) {
  const consulta = req.query;
  const anio = leerEntero(consulta.anio, 'El año', ANIO_MINIMO, ANIO_MAXIMO, 'PERIODO_INVALIDO');
  const mes = leerEntero(consulta.mes, 'El mes', 1, 12, 'PERIODO_INVALIDO');
  const pagina = leerPaginado(consulta.pagina, 1, 'La página');
  const porPagina = Math.min(leerPaginado(consulta.por_pagina, POR_PAGINA, 'La cantidad por página'), MAXIMO_POR_PAGINA);

  const { cuotas: encontradas, total } = await cuotas.listarPeriodo({
    anio,
    mes,
    estado: leerEstado(consulta.estado),
    palabras: leerPalabras(consulta.q),
    pagina,
    porPagina,
  });

  const totales = await cuotas.resumenDelPeriodo(anio, mes);

  res.json({
    ok: true,
    periodo: { anio, mes },
    resumen: {
      facturado: redondear(totales.facturado),
      cobrado: redondear(totales.facturado - totales.saldos),
      pendiente: redondear(totales.saldos - totales.vencido),
      vencido: redondear(totales.vencido),
      cuotas: totales.cuotas,
      cuotas_pendientes: totales.cuotas_pendientes,
      internos_con_vencidas: totales.internos_con_vencidas,
    },
    cuotas: encontradas,
    paginacion: {
      pagina,
      por_pagina: porPagina,
      total,
      total_paginas: Math.ceil(total / porPagina),
    },
  });
}

module.exports = { generar, listar };
