const { and, asc, eq } = require('drizzle-orm');
const { db } = require('../db/d1');
const {
  internos,
  estados,
  obrasSociales,
  contactosFamiliares,
  historialEstados,
} = require('../db/schema');
const legajos = require('./legajos.service');

// Un interno se considera duplicado solo si el DNI ya existe entre los activos
// (RN6): los egresados pueden tener el mismo DNI si algún día vuelven a ingresar.
async function buscarActivoPorDni(dni) {
  const [fila] = await db()
    .select({
      id: internos.id,
      dni: internos.dni,
      apellido: internos.apellido,
      nombre: internos.nombre,
    })
    .from(internos)
    .innerJoin(estados, eq(estados.id, internos.estado_id))
    .where(and(eq(internos.dni, dni), eq(estados.nombre, 'activo')))
    .limit(1);

  return fila || null;
}

// Inserta el interno y devuelve su id. Los campos opcionales que vengan sin
// valor se guardan como NULL: D1 no acepta undefined.
async function crear(datos) {
  const [fila] = await db()
    .insert(internos)
    .values({
      dni: datos.dni,
      apellido: datos.apellido,
      nombre: datos.nombre,
      fecha_nacimiento: datos.fechaNacimiento ?? null,
      judicializado: datos.judicializado ?? 0,
      datos_salud: datos.datosSalud ?? null,
      obra_social_id: datos.obraSocialId ?? null,
      fecha_ingreso: datos.fechaIngreso,
      estado_id: datos.estadoId,
      creado_por: datos.creadoPor ?? null,
    })
    .returning({ id: internos.id });

  return fila.id;
}

async function agregarContactos(internoId, contactos) {
  for (const contacto of contactos) {
    await db()
      .insert(contactosFamiliares)
      .values({
        interno_id: internoId,
        nombre: contacto.nombre,
        parentesco: contacto.parentesco ?? null,
        telefono: contacto.telefono ?? null,
        email: contacto.email ?? null,
      });
  }

  return contactos.length;
}

// Cada cambio de estado deja una fila en el historial (RN10). En el alta el
// motivo va vacío; en la baja es obligatorio.
async function registrarEstado(internoId, estadoId, usuarioId, motivo = null) {
  await db().insert(historialEstados).values({
    interno_id: internoId,
    estado_id: estadoId,
    usuario_id: usuarioId ?? null,
    motivo,
  });
}

async function listarContactos(internoId) {
  return db()
    .select({
      id: contactosFamiliares.id,
      nombre: contactosFamiliares.nombre,
      parentesco: contactosFamiliares.parentesco,
      telefono: contactosFamiliares.telefono,
      email: contactosFamiliares.email,
    })
    .from(contactosFamiliares)
    .where(eq(contactosFamiliares.interno_id, internoId))
    .orderBy(asc(contactosFamiliares.id));
}

// Lo que se devuelve después del alta: el interno con su estado, su obra social,
// sus legajos y sus contactos. La ficha completa con historial es BS-4.
// La obra social va con leftJoin porque es opcional: si no tiene, viene NULL.
async function obtenerFichaBasica(internoId) {
  const [interno] = await db()
    .select({
      id: internos.id,
      dni: internos.dni,
      apellido: internos.apellido,
      nombre: internos.nombre,
      fecha_nacimiento: internos.fecha_nacimiento,
      judicializado: internos.judicializado,
      datos_salud: internos.datos_salud,
      fecha_ingreso: internos.fecha_ingreso,
      creado_por: internos.creado_por,
      creado_en: internos.creado_en,
      estado: estados.nombre,
      obra_social: obrasSociales.nombre,
    })
    .from(internos)
    .innerJoin(estados, eq(estados.id, internos.estado_id))
    .leftJoin(obrasSociales, eq(obrasSociales.id, internos.obra_social_id))
    .where(eq(internos.id, internoId))
    .limit(1);

  if (!interno) {
    return null;
  }

  return {
    ...interno,
    legajos: await legajos.listarPorInterno(internoId),
    contactos: await listarContactos(internoId),
  };
}

module.exports = {
  buscarActivoPorDni,
  crear,
  agregarContactos,
  registrarEstado,
  listarContactos,
  obtenerFichaBasica,
};
