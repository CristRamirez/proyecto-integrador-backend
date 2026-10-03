const { and, asc, count, desc, eq, exists, gt, lt, ne, or, sql } = require('drizzle-orm');
const { db } = require('../db/d1');
const {
  internos,
  estados,
  obrasSociales,
  contactosFamiliares,
  historialEstados,
  usuarios,
  legajos: tablaLegajos,
  cuotas,
  estadosCuota,
} = require('../db/schema');
const legajos = require('./legajos.service');

// SQLite no tiene una función para sacar acentos y su lower() solo pasa a
// minúscula las letras sin acento, así que se arma con replace(). La ñ también
// se iguala a la n: así "nunez" encuentra a Núñez aunque se escriba sin ñ. Las letras
// van escritas en el SQL (sql.raw) y no como parámetros, porque D1 acepta
// hasta 100 parámetros por consulta y acá serían más de diez por columna.
const ACENTOS = [
  ['á', 'a'], ['é', 'e'], ['í', 'i'], ['ó', 'o'], ['ú', 'u'], ['ü', 'u'],
  ['Á', 'a'], ['É', 'e'], ['Í', 'i'], ['Ó', 'o'], ['Ú', 'u'], ['Ü', 'u'],
  ['ñ', 'n'], ['Ñ', 'n'],
];

function sinAcentos(columna) {
  return ACENTOS.reduce(
    (expresion, [con, sin]) => sql`replace(${expresion}, ${sql.raw(`'${con}'`)}, ${sql.raw(`'${sin}'`)})`,
    sql`lower(${columna})`
  );
}

// El texto buscado se normaliza igual que las columnas, del lado de JS.
function normalizar(texto) {
  return ACENTOS.reduce((resultado, [con, sin]) => resultado.split(con).join(sin), texto.toLowerCase());
}

// % y _ son comodines de LIKE: si vienen en lo buscado se escapan para que
// se busquen tal cual.
function contiene(columna, palabra) {
  const patron = `%${normalizar(palabra).replace(/[\\%_]/g, '\\$&')}%`;

  return sql`${sinAcentos(columna)} LIKE ${patron} ESCAPE '\\'`;
}

// Cada palabra tiene que aparecer en alguno de los cuatro campos (DNI,
// apellido, nombre o algún legajo): "perez juan" encuentra a Juan Pérez.
function coincideCon(palabra) {
  return or(
    contiene(internos.dni, palabra),
    contiene(internos.apellido, palabra),
    contiene(internos.nombre, palabra),
    exists(
      db()
        .select({ id: tablaLegajos.id })
        .from(tablaLegajos)
        .where(and(eq(tablaLegajos.interno_id, internos.id), contiene(tablaLegajos.numero, palabra)))
    )
  );
}

// Un interno tiene deuda si le queda saldo en alguna cuota ya vencida que no
// esté anulada. Mientras no se generen cuotas, nadie aparece con deuda.
function tieneDeuda() {
  return exists(
    db()
      .select({ id: cuotas.id })
      .from(cuotas)
      .innerJoin(estadosCuota, eq(estadosCuota.id, cuotas.estado_cuota_id))
      .where(
        and(
          eq(cuotas.interno_id, internos.id),
          gt(cuotas.saldo_pendiente, 0),
          lt(cuotas.fecha_vencimiento, sql`date('now')`),
          ne(estadosCuota.nombre, 'anulada')
        )
      )
  );
}

// El legajo que se muestra en la lista es el último que se abrió.
function ultimoLegajo() {
  return sql`(${db()
    .select({ numero: tablaLegajos.numero })
    .from(tablaLegajos)
    .where(eq(tablaLegajos.interno_id, internos.id))
    .orderBy(desc(tablaLegajos.id))
    .limit(1)})`;
}

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

// Guarda los datos que cambiaron y deja registrado quién y cuándo hizo la
// modificación (BS-5). Se llama aunque solo cambien los contactos, porque
// también es una modificación del interno.
async function actualizar(internoId, cambios, usuarioId) {
  await db()
    .update(internos)
    .set({
      ...cambios,
      modificado_por: usuarioId ?? null,
      modificado_en: sql`(datetime('now'))`,
    })
    .where(eq(internos.id, internoId));
}

// Los contactos se reemplazan enteros: se borran los que había y se cargan
// los que vienen, igual que los módulos de un rol.
async function reemplazarContactos(internoId, contactos) {
  await db().delete(contactosFamiliares).where(eq(contactosFamiliares.interno_id, internoId));

  return agregarContactos(internoId, contactos);
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

// Lo que se devuelve después del alta y de la modificación: el interno con su
// estado, su obra social, sus legajos y sus contactos. La ficha completa con
// historial es BS-4.
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
      modificado_por: internos.modificado_por,
      modificado_en: internos.modificado_en,
      estado: estados.nombre,
      obra_social_id: internos.obra_social_id,
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

async function listarHistorial(internoId) {
  return db()
    .select({
      id: historialEstados.id,
      estado: estados.nombre,
      fecha: historialEstados.fecha,
      motivo: historialEstados.motivo,
      usuario: usuarios.nombre_completo,
    })
    .from(historialEstados)
    .innerJoin(estados, eq(estados.id, historialEstados.estado_id))
    .leftJoin(usuarios, eq(usuarios.id, historialEstados.usuario_id))
    .where(eq(historialEstados.interno_id, internoId))
    .orderBy(asc(historialEstados.fecha), asc(historialEstados.id));
}

async function obtenerFicha(internoId) {
  const interno = await obtenerFichaBasica(internoId);

  if (!interno) {
    return null;
  }

  return { ...interno, historial: await listarHistorial(internoId) };
}

// Padrón de internos (BS-3): búsqueda por texto, filtros y paginación.
// Todos los criterios se combinan entre sí. Devuelve la página pedida y el
// total de internos que cumplen, para que el front arme el paginado.
async function buscar({ palabras = [], estadoId = null, judicializado = null, pagina = 1, porPagina = 20 }) {
  const condiciones = palabras.map(coincideCon);

  if (estadoId !== null) {
    condiciones.push(eq(internos.estado_id, estadoId));
  }

  if (judicializado !== null) {
    condiciones.push(eq(internos.judicializado, judicializado));
  }

  const filtro = condiciones.length ? and(...condiciones) : undefined;

  const [{ total }] = await db().select({ total: count() }).from(internos).where(filtro);

  const filas = await db()
    .select({
      id: internos.id,
      dni: internos.dni,
      apellido: internos.apellido,
      nombre: internos.nombre,
      legajo: ultimoLegajo(),
      estado: estados.nombre,
      judicializado: internos.judicializado,
      fecha_ingreso: internos.fecha_ingreso,
      tiene_deuda: sql`${tieneDeuda()}`.mapWith(Boolean),
    })
    .from(internos)
    .innerJoin(estados, eq(estados.id, internos.estado_id))
    .where(filtro)
    // Se ordena sin acentos ni mayúsculas para que Álvarez no quede después de Zárate.
    .orderBy(asc(sinAcentos(internos.apellido)), asc(sinAcentos(internos.nombre)), asc(internos.id))
    .limit(porPagina)
    .offset((pagina - 1) * porPagina);

  return { internos: filas, total };
}

module.exports = {
  buscar,
  buscarActivoPorDni,
  crear,
  actualizar,
  agregarContactos,
  reemplazarContactos,
  registrarEstado,
  listarContactos,
  obtenerFichaBasica,
  listarHistorial,
  obtenerFicha,
};
