-- ============================================================
-- Proyecto Integrador - Esquema de base de datos (D1 / SQLite)
-- Alcance: login con roles (BS-1) + módulo Internos (BS-2 a BS-6)
-- ============================================================

-- ------------------------------------------------------------
-- AUTH
-- ------------------------------------------------------------

-- Cada usuario tiene un rol. Separamos roles en su propia tabla
-- para no repetir el texto del rol en cada usuario.
CREATE TABLE IF NOT EXISTS roles (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT    NOT NULL UNIQUE            -- ej: administrador, empleado
);

-- Usuarios que pueden iniciar sesión.
CREATE TABLE IF NOT EXISTS usuarios (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_usuario  TEXT    NOT NULL UNIQUE,          -- con qué se loguea
  nombre_completo TEXT,                             -- nombre para mostrar
  email           TEXT    UNIQUE,
  password_hash   TEXT    NOT NULL,                 -- hash bcrypt, nunca texto plano
  rol_id          INTEGER NOT NULL,
  activo          INTEGER NOT NULL DEFAULT 1,       -- 1 = habilitado, 0 = deshabilitado
  intentos_fallidos INTEGER NOT NULL DEFAULT 0,     -- logins fallidos seguidos (BS-1)
  bloqueado_hasta TEXT,                             -- con fecha futura, no puede iniciar sesión
  creado_en       TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (rol_id) REFERENCES roles(id)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol_id);

-- Módulos del sistema (internos, cobranzas, etc.).
CREATE TABLE IF NOT EXISTS modulos (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT    NOT NULL UNIQUE
);

-- Permisos: qué roles acceden a qué módulos (relación N:N).
CREATE TABLE IF NOT EXISTS rol_modulo (
  rol_id    INTEGER NOT NULL,
  modulo_id INTEGER NOT NULL,
  PRIMARY KEY (rol_id, modulo_id),           -- clave compuesta: un rol-módulo no se repite
  FOREIGN KEY (rol_id)    REFERENCES roles(id),
  FOREIGN KEY (modulo_id) REFERENCES modulos(id)
);

-- ------------------------------------------------------------
-- CATÁLOGOS (Internos)
-- ------------------------------------------------------------

-- Estados posibles de un interno (activo, egresado, etc.).
CREATE TABLE IF NOT EXISTS estados (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT    NOT NULL UNIQUE
);

-- Obras sociales / coberturas.
CREATE TABLE IF NOT EXISTS obras_sociales (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT    NOT NULL UNIQUE
);

-- ------------------------------------------------------------
-- INTERNOS
-- ------------------------------------------------------------

-- Padrón de internos.
CREATE TABLE IF NOT EXISTS internos (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  dni              TEXT    NOT NULL,                -- único entre activos (regla de negocio)
  apellido         TEXT    NOT NULL,
  nombre           TEXT    NOT NULL,
  fecha_nacimiento TEXT,
  judicializado    INTEGER NOT NULL DEFAULT 0,      -- 1 = judicializado, 0 = no
  datos_salud      TEXT,                            -- datos de salud / observaciones
  obra_social_id   INTEGER,                         -- cobertura
  fecha_ingreso    TEXT    NOT NULL,                -- inmutable
  estado_id        INTEGER NOT NULL,                -- estado actual
  creado_por       INTEGER,                         -- usuario que dio el alta
  creado_en        TEXT    NOT NULL DEFAULT (datetime('now')),
  modificado_por   INTEGER,                         -- usuario de la última modificación
  modificado_en    TEXT,
  FOREIGN KEY (obra_social_id) REFERENCES obras_sociales(id),
  FOREIGN KEY (estado_id)      REFERENCES estados(id),
  FOREIGN KEY (creado_por)     REFERENCES usuarios(id),
  FOREIGN KEY (modificado_por) REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_internos_dni    ON internos(dni);
CREATE INDEX IF NOT EXISTS idx_internos_estado ON internos(estado_id);

-- Legajos del interno. Un interno puede tener varios legajos (relación 1:N).
CREATE TABLE IF NOT EXISTS legajos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  interno_id     INTEGER NOT NULL,                  -- 1:N con internos (sin UNIQUE)
  numero         TEXT    NOT NULL UNIQUE,           -- formato LEG-AAAAMMDD-NNNN, inmutable
  fecha_apertura TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (interno_id) REFERENCES internos(id)
);

CREATE INDEX IF NOT EXISTS idx_legajos_interno ON legajos(interno_id);

-- Contactos familiares del interno (mínimo 2 por interno: regla de negocio).
CREATE TABLE IF NOT EXISTS contactos_familiares (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  interno_id INTEGER NOT NULL,
  nombre     TEXT    NOT NULL,
  parentesco TEXT,
  telefono   TEXT,
  email      TEXT,
  FOREIGN KEY (interno_id) REFERENCES internos(id)
);

CREATE INDEX IF NOT EXISTS idx_contactos_interno ON contactos_familiares(interno_id);

-- Historial de cambios de estado del interno (línea de tiempo, BS-4/BS-6).
CREATE TABLE IF NOT EXISTS historial_estados (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  interno_id INTEGER NOT NULL,
  estado_id  INTEGER NOT NULL,
  fecha      TEXT    NOT NULL DEFAULT (datetime('now')),
  motivo     TEXT,                                  -- obligatorio en la baja
  usuario_id INTEGER,                               -- quién hizo el cambio
  FOREIGN KEY (interno_id) REFERENCES internos(id),
  FOREIGN KEY (estado_id)  REFERENCES estados(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_historial_interno ON historial_estados(interno_id);

-- ------------------------------------------------------------
-- DATOS INICIALES
-- ------------------------------------------------------------

INSERT OR IGNORE INTO roles (nombre) VALUES
  ('administrador'),
  ('empleado'),
  ('operador'),
  ('contador'),
  ('solo lectura');

INSERT OR IGNORE INTO estados (nombre) VALUES
  ('activo'),
  ('egresado');

INSERT OR IGNORE INTO modulos (nombre) VALUES
  ('internos'),
  ('cobranzas'),
  ('reportes'),
  ('usuarios'),
  ('auditoria'),
  ('parametros');

-- El rol administrador accede a todos los módulos.
INSERT OR IGNORE INTO rol_modulo (rol_id, modulo_id)
SELECT r.id, m.id
FROM roles r, modulos m
WHERE r.nombre = 'administrador';
