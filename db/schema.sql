-- ============================================================
-- Proyecto Integrador - Esquema de base de datos (D1 / SQLite)
-- Alcance actual: solo lo necesario para el login con roles (BS-1)
-- ============================================================

-- Cada usuario tiene un rol. Separamos roles en su propia tabla
-- para no repetir el texto del rol en cada usuario y poder
-- agregar/quitar roles sin tocar la tabla de usuarios.
CREATE TABLE IF NOT EXISTS roles (
  id     INTEGER PRIMARY KEY AUTOINCREMENT, -- identificador interno del rol
  nombre TEXT    NOT NULL UNIQUE            -- ej: administrador, operador
);

-- Usuarios que pueden iniciar sesión.
CREATE TABLE IF NOT EXISTS usuarios (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_usuario  TEXT    NOT NULL UNIQUE,          -- con qué se loguea
  nombre_completo TEXT,                             -- nombre para mostrar
  email           TEXT    UNIQUE,
  password_hash   TEXT    NOT NULL,                 -- NUNCA la contraseña en texto: se guarda el hash
  rol_id          INTEGER NOT NULL,                 -- a qué rol pertenece
  activo          INTEGER NOT NULL DEFAULT 1,       -- 1 = habilitado, 0 = deshabilitado
  creado_en       TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (rol_id) REFERENCES roles(id)         -- rol_id debe existir en roles
);

-- Índice para buscar rápido los usuarios de un rol.
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol_id);

-- Roles iniciales.
INSERT OR IGNORE INTO roles (nombre) VALUES
  ('administrador'),
  ('empleado');
