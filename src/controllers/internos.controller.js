const ApiError = require('../utils/ApiError');
const internos = require('../services/internos.service');
const legajos = require('../services/legajos.service');
const catalogos = require('../services/catalogos.service');

const ESTADO_INICIAL = 'activo';
const MINIMO_CONTACTOS = 2;
const POR_PAGINA = 20;
const MAXIMO_POR_PAGINA = 100;
// Cada palabra suma parámetros a la consulta y D1 acepta hasta 100: con 5
// palabras sobra para buscar por nombre completo.
const MAXIMO_PALABRAS = 5;

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function esFecha(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }

  const fecha = new Date(`${valor}T00:00:00Z`);

  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function leerDni(valor) {
  const dni = texto(valor);

  if (!dni) {
    throw ApiError.solicitudInvalida('El DNI es obligatorio', 'DATOS_INCOMPLETOS');
  }

  if (!/^\d{7,8}$/.test(dni)) {
    throw ApiError.solicitudInvalida('El DNI tiene que ser un número de 7 u 8 dígitos', 'DNI_INVALIDO');
  }

  return dni;
}

function leerObligatorio(valor, etiqueta) {
  const contenido = texto(valor);

  if (!contenido) {
    throw ApiError.solicitudInvalida(`Falta ${etiqueta}`, 'DATOS_INCOMPLETOS');
  }

  return contenido;
}

function leerFechaOpcional(valor, etiqueta) {
  if (valor === undefined || valor === null || texto(valor) === '') {
    return null;
  }

  const fecha = texto(valor);

  if (!esFecha(fecha)) {
    throw ApiError.solicitudInvalida(`${etiqueta} tiene que tener el formato AAAA-MM-DD`, 'FECHA_INVALIDA');
  }

  return fecha;
}

function leerFechaIngreso(valor) {
  const fecha = leerFechaOpcional(valor, 'La fecha de ingreso') || hoy();

  if (fecha > hoy()) {
    throw ApiError.solicitudInvalida('La fecha de ingreso no puede ser futura', 'FECHA_INVALIDA');
  }

  return fecha;
}

function leerJudicializado(valor) {
  if (valor === undefined || valor === null || valor === '') {
    return 0;
  }

  if (valor === true || valor === 1 || valor === '1' || valor === 'true') {
    return 1;
  }

  if (valor === false || valor === 0 || valor === '0' || valor === 'false') {
    return 0;
  }

  throw ApiError.solicitudInvalida('El campo judicializado solo acepta 1 o 0', 'DATOS_INVALIDOS');
}

function leerContactos(valor) {
  if (!Array.isArray(valor) || valor.length < MINIMO_CONTACTOS) {
    throw ApiError.solicitudInvalida(
      `Hay que cargar al menos ${MINIMO_CONTACTOS} contactos familiares`,
      'CONTACTOS_INSUFICIENTES'
    );
  }

  return valor.map((contacto, posicion) => {
    const nombre = texto((contacto || {}).nombre);
    const telefono = texto((contacto || {}).telefono);
    const email = texto((contacto || {}).email);

    if (!nombre) {
      throw ApiError.solicitudInvalida(`Falta el nombre del contacto ${posicion + 1}`, 'CONTACTO_INVALIDO');
    }

    if (!telefono && !email) {
      throw ApiError.solicitudInvalida(
        `El contacto ${posicion + 1} necesita un teléfono o un email`,
        'CONTACTO_INVALIDO'
      );
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw ApiError.solicitudInvalida(`El email del contacto ${posicion + 1} no es válido`, 'CONTACTO_INVALIDO');
    }

    return {
      nombre,
      parentesco: texto((contacto || {}).parentesco) || null,
      telefono: telefono || null,
      email: email || null,
    };
  });
}

async function leerObraSocial(valor) {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }

  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.solicitudInvalida('La obra social no es válida', 'ID_INVALIDO');
  }

  const disponibles = await catalogos.listarObrasSociales();

  if (!disponibles.some((obraSocial) => obraSocial.id === id)) {
    throw ApiError.solicitudInvalida('La obra social no existe', 'OBRA_SOCIAL_INEXISTENTE');
  }

  return id;
}

async function alta(req, res) {
  const cuerpo = req.body || {};

  const datos = {
    dni: leerDni(cuerpo.dni),
    apellido: leerObligatorio(cuerpo.apellido, 'el apellido'),
    nombre: leerObligatorio(cuerpo.nombre, 'el nombre'),
    fechaNacimiento: leerFechaOpcional(cuerpo.fecha_nacimiento, 'La fecha de nacimiento'),
    judicializado: leerJudicializado(cuerpo.judicializado),
    datosSalud: texto(cuerpo.datos_salud) || null,
    fechaIngreso: leerFechaIngreso(cuerpo.fecha_ingreso),
    creadoPor: req.usuario.id,
  };

  const contactos = leerContactos(cuerpo.contactos);
  datos.obraSocialId = await leerObraSocial(cuerpo.obra_social_id);

  if (await internos.buscarActivoPorDni(datos.dni)) {
    throw new ApiError(409, 'Ya hay un interno activo con ese DNI', 'DNI_DUPLICADO');
  }

  const estado = await catalogos.buscarEstadoPorNombre(ESTADO_INICIAL);

  if (!estado) {
    throw new ApiError(500, 'Falta el estado inicial en la base de datos', 'ESTADO_INICIAL_FALTANTE');
  }

  datos.estadoId = estado.id;

  const internoId = await internos.crear(datos);

  await legajos.crear(internoId, await legajos.generarNumero());
  await internos.agregarContactos(internoId, contactos);
  await internos.registrarEstado(internoId, estado.id, req.usuario.id);

  res.status(201).json({ ok: true, interno: await internos.obtenerFichaBasica(internoId) });
}

function leerPalabras(valor) {
  return texto(valor).split(/\s+/).filter(Boolean).slice(0, MAXIMO_PALABRAS);
}

async function leerFiltroEstado(valor) {
  const nombre = texto(valor).toLowerCase();

  if (!nombre) {
    return null;
  }

  const estado = await catalogos.buscarEstadoPorNombre(nombre);

  if (!estado) {
    throw ApiError.solicitudInvalida('El estado no existe', 'ESTADO_INEXISTENTE');
  }

  return estado.id;
}

// En el filtro, que no venga significa "todos", no "no judicializado".
function leerFiltroJudicializado(valor) {
  if (valor === undefined || texto(valor) === '') {
    return null;
  }

  return leerJudicializado(texto(valor));
}

function leerEnteroPositivo(valor, porDefecto, etiqueta) {
  if (valor === undefined || texto(valor) === '') {
    return porDefecto;
  }

  const numero = Number(valor);

  if (!Number.isInteger(numero) || numero <= 0) {
    throw ApiError.solicitudInvalida(`${etiqueta} tiene que ser un número entero mayor a cero`, 'PAGINACION_INVALIDA');
  }

  return numero;
}

// GET /api/internos?q=&estado=&judicializado=&pagina=&por_pagina=
async function listar(req, res) {
  const consulta = req.query;
  const pagina = leerEnteroPositivo(consulta.pagina, 1, 'La página');
  const porPagina = Math.min(
    leerEnteroPositivo(consulta.por_pagina, POR_PAGINA, 'La cantidad por página'),
    MAXIMO_POR_PAGINA
  );

  const { internos: encontrados, total } = await internos.buscar({
    palabras: leerPalabras(consulta.q),
    estadoId: await leerFiltroEstado(consulta.estado),
    judicializado: leerFiltroJudicializado(consulta.judicializado),
    pagina,
    porPagina,
  });

  res.json({
    ok: true,
    internos: encontrados,
    paginacion: {
      pagina,
      por_pagina: porPagina,
      total,
      total_paginas: Math.ceil(total / porPagina),
    },
  });
}

// GET /api/internos/verificar-dni/:dni
// La usa la pantalla de alta para avisar del DNI repetido apenas se escribe,
// antes de tocar "Guardar". El alta lo vuelve a controlar igual al guardar.
async function verificarDni(req, res) {
  const interno = await internos.buscarActivoPorDni(leerDni(req.params.dni));

  res.json({ ok: true, duplicado: Boolean(interno), interno });
}

module.exports = { alta, listar, verificarDni };
