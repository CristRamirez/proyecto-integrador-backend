-- Claves de integración con otros servicios.
--
-- db/schema.sql ya quedó actualizado, pero sus CREATE TABLE no corren sobre una
-- base que ya existe. Correr una sola vez:
--   npx wrangler d1 execute proyecto-integrador-aca --remote --file=db/migracion_claves.sql

CREATE TABLE IF NOT EXISTS claves_integracion (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  servicio       TEXT    NOT NULL UNIQUE,           -- con qué servicio se integra
  descripcion    TEXT,                              -- para qué se usa
  valor          TEXT    NOT NULL,                  -- la clave; la API nunca la devuelve
  activo         INTEGER NOT NULL DEFAULT 1,
  usuario_id     INTEGER,                           -- quién la cargó
  creado_en      TEXT    NOT NULL DEFAULT (datetime('now')),
  modificado_por INTEGER,
  modificado_en  TEXT,
  FOREIGN KEY (usuario_id)     REFERENCES usuarios(id),
  FOREIGN KEY (modificado_por) REFERENCES usuarios(id)
);
