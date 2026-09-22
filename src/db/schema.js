const { sql } = require('drizzle-orm');
const { sqliteTable, integer, text, primaryKey } = require('drizzle-orm/sqlite-core');

// Las tablas del sistema descritas para el ORM. Es el mismo esquema que crea
// db/schema.sql: si se toca una tabla allá, hay que tocarla acá también.
// Las propiedades se llaman igual que las columnas para que lo que devuelven
// las consultas tenga exactamente los mismos nombres que antes.
//
// Las columnas de fecha llevan su valor por defecto declarado acá además de en
// la base: si no se lo decimos, el ORM manda NULL en los INSERT y la columna
// es NOT NULL.

// ------------------------------------------------------------
// AUTH
// ------------------------------------------------------------

const roles = sqliteTable('roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
});

const usuarios = sqliteTable('usuarios', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre_usuario: text('nombre_usuario').notNull(),
  nombre_completo: text('nombre_completo'),
  email: text('email'),
  password_hash: text('password_hash').notNull(),
  rol_id: integer('rol_id').notNull(),
  activo: integer('activo').notNull().default(1),
  creado_en: text('creado_en').notNull().default(sql`(datetime('now'))`),
});

const modulos = sqliteTable('modulos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
});

// Relación N:N entre roles y módulos: la clave primaria es compuesta.
const rolModulo = sqliteTable(
  'rol_modulo',
  {
    rol_id: integer('rol_id').notNull(),
    modulo_id: integer('modulo_id').notNull(),
  },
  (tabla) => ({
    pk: primaryKey({ columns: [tabla.rol_id, tabla.modulo_id] }),
  })
);

// ------------------------------------------------------------
// CATÁLOGOS
// ------------------------------------------------------------

const estados = sqliteTable('estados', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
});

const obrasSociales = sqliteTable('obras_sociales', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
});

// ------------------------------------------------------------
// INTERNOS
// ------------------------------------------------------------

const internos = sqliteTable('internos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dni: text('dni').notNull(),
  apellido: text('apellido').notNull(),
  nombre: text('nombre').notNull(),
  fecha_nacimiento: text('fecha_nacimiento'),
  judicializado: integer('judicializado').notNull().default(0),
  datos_salud: text('datos_salud'),
  obra_social_id: integer('obra_social_id'),
  fecha_ingreso: text('fecha_ingreso').notNull(),
  estado_id: integer('estado_id').notNull(),
  creado_por: integer('creado_por'),
  creado_en: text('creado_en').notNull().default(sql`(datetime('now'))`),
  modificado_por: integer('modificado_por'),
  modificado_en: text('modificado_en'),
});

const legajos = sqliteTable('legajos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  interno_id: integer('interno_id').notNull(),
  numero: text('numero').notNull(),
  fecha_apertura: text('fecha_apertura').notNull().default(sql`(datetime('now'))`),
});

const contactosFamiliares = sqliteTable('contactos_familiares', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  interno_id: integer('interno_id').notNull(),
  nombre: text('nombre').notNull(),
  parentesco: text('parentesco'),
  telefono: text('telefono'),
  email: text('email'),
});

const historialEstados = sqliteTable('historial_estados', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  interno_id: integer('interno_id').notNull(),
  estado_id: integer('estado_id').notNull(),
  fecha: text('fecha').notNull().default(sql`(datetime('now'))`),
  motivo: text('motivo'),
  usuario_id: integer('usuario_id'),
});

module.exports = {
  roles,
  usuarios,
  modulos,
  rolModulo,
  estados,
  obrasSociales,
  internos,
  legajos,
  contactosFamiliares,
  historialEstados,
};
