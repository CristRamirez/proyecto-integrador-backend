-- ============================================================
-- Auditoría transversal (regla 13) y consulta del log
-- Se corre UNA sola vez sobre la base que ya está creada en D1.
-- La tabla ya venía en db/schema.sql; el CREATE va con IF NOT EXISTS por si
-- la base se creó antes de que estuviera. Lo nuevo es el índice por fecha,
-- que es por donde filtra y ordena la consulta.
-- ============================================================

CREATE TABLE IF NOT EXISTS auditoria (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  accion     TEXT    NOT NULL,
  entidad    TEXT    NOT NULL,
  entidad_id INTEGER,
  detalle    TEXT,
  fecha      TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON auditoria(entidad, entidad_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha   ON auditoria(fecha);
