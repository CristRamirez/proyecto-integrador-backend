-- Usuario admin de PRUEBA. Clave en claro: admin1234 (cambiar en producción).
-- El password_hash es bcrypt (cost 10) generado a partir de 'admin1234'.
-- rol_id = 1 => administrador
INSERT OR IGNORE INTO usuarios (nombre_usuario, nombre_completo, email, password_hash, rol_id)
VALUES (
  'admin',
  'Administrador de prueba',
  'admin@proyecto.local',
  '$2b$10$JwmE1Nu3KJwzFVqh6AmTzOSsiaXl2vrhH96IzO/pJN7o5PT3jkbBO',
  1
);
