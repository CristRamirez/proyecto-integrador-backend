const { and, asc, count, desc, eq, sql } = require('drizzle-orm');
const { db } = require('../db/d1');
const { auditoria, usuarios } = require('../db/schema');

// Regla 13: toda alta, modificación y baja queda registrada con quién la hizo
// y cuándo. Cada controlador llama a registrar() después de guardar; la fecha
// la pone la base (UTC, como el resto de las fechas con hora del sistema).
const ACCIONES = {
  ALTA: 'alta',
  MODIFICACION: 'modificacion',
  BAJA: 'baja',
  REINGRESO: 'reingreso',
  ANULACION: 'anulacion',
  GENERACION: 'generacion',
  MORA: 'mora',
  LOGIN: 'login',
};

const COLUMNAS = {
  id: auditoria.id,
  fecha: auditoria.fecha,
  accion: auditoria.accion,
  entidad: auditoria.entidad,
  entidad_id: auditoria.entidad_id,
  detalle: auditoria.detalle,
  usuario_id: auditoria.usuario_id,
  usuario: usuarios.nombre_usuario,
  usuario_nombre: usuarios.nombre_completo,
};

// Si falla el registro no se corta la operación: lo que el usuario hizo ya se
// guardó, y devolverle un error lo haría reintentar y duplicarlo. Queda en el log.
async function registrar(usuarioId, accion, entidad, entidadId = null, detalle = null) {
  try {
    await db()
      .insert(auditoria)
      .values({
        usuario_id: usuarioId ?? null,
        accion,
        entidad,
        entidad_id: entidadId ?? null,
        detalle: detalle === null ? null : JSON.stringify(detalle),
      });
  } catch (error) {
    console.error('[auditoria] No se pudo registrar', { accion, entidad, entidadId }, error);
  }
}

// Los campos que cambiaron entre lo que había y lo que se guardó, para el
// detalle de una modificación: { campo: { antes, despues } }.
function cambios(antes, despues) {
  const distintos = {};

  for (const [campo, valor] of Object.entries(despues)) {
    const previo = antes[campo] ?? null;

    if ((valor ?? null) !== previo) {
      distintos[campo] = { antes: previo, despues: valor ?? null };
    }
  }

  return distintos;
}

function filtro({ usuarioId, accion, entidad, desde, hasta }) {
  const condiciones = [];

  if (usuarioId) {
    condiciones.push(eq(auditoria.usuario_id, usuarioId));
  }

  if (accion) {
    condiciones.push(eq(auditoria.accion, accion));
  }

  if (entidad) {
    condiciones.push(eq(auditoria.entidad, entidad));
  }

  if (desde) {
    condiciones.push(sql`substr(${auditoria.fecha}, 1, 10) >= ${desde}`);
  }

  if (hasta) {
    condiciones.push(sql`substr(${auditoria.fecha}, 1, 10) <= ${hasta}`);
  }

  return condiciones.length ? and(...condiciones) : undefined;
}

function conDetalle(fila) {
  let detalle = fila.detalle;

  try {
    detalle = detalle === null ? null : JSON.parse(detalle);
  } catch {
    // Quedó como texto plano: se devuelve tal cual.
  }

  return { ...fila, detalle };
}

async function listar({ pagina, porPagina, ...filtros }) {
  const condicion = filtro(filtros);

  const [conteo] = await db()
    .select({ total: count() })
    .from(auditoria)
    .where(condicion);

  const filas = await db()
    .select(COLUMNAS)
    .from(auditoria)
    .leftJoin(usuarios, eq(usuarios.id, auditoria.usuario_id))
    .where(condicion)
    .orderBy(desc(auditoria.fecha), desc(auditoria.id))
    .limit(porPagina)
    .offset((pagina - 1) * porPagina);

  return { registros: filas.map(conDetalle), total: conteo ? conteo.total : 0 };
}

// Las opciones de los desplegables de la pantalla: las acciones y entidades que
// ya aparecen en el registro y todos los usuarios del sistema.
async function opcionesDeFiltro() {
  const acciones = await db()
    .selectDistinct({ accion: auditoria.accion })
    .from(auditoria)
    .orderBy(asc(auditoria.accion));

  const entidades = await db()
    .selectDistinct({ entidad: auditoria.entidad })
    .from(auditoria)
    .orderBy(asc(auditoria.entidad));

  const todos = await db()
    .select({ id: usuarios.id, usuario: usuarios.nombre_usuario, nombre: usuarios.nombre_completo })
    .from(usuarios)
    .orderBy(asc(usuarios.nombre_usuario));

  return {
    acciones: acciones.map((fila) => fila.accion),
    entidades: entidades.map((fila) => fila.entidad),
    usuarios: todos,
  };
}

module.exports = { ACCIONES, registrar, cambios, listar, opcionesDeFiltro };
