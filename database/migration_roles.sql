-- Roles: admin y profesional
-- Ejecutar en tapaicentro_calendar si la columna role aún usa 'staff'

UPDATE users SET role = 'profesional' WHERE role = 'staff';

ALTER TABLE users
  MODIFY role ENUM('admin','profesional') NOT NULL DEFAULT 'profesional';

-- Usuario profesional por defecto (contraseña: profesional123)
INSERT INTO users (username, email, password_hash, full_name, role, active)
SELECT 'profesional', 'profesional@tapaicentro.com',
  '$2y$12$.5YzYW4zZt1uU6KLQjZEA.HsCg.ohlmjD/1lDmqTMAxdZtM2UJhB6',
  'Profesional Tapai', 'profesional', 1
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'profesional');

UPDATE users SET role = 'admin' WHERE username = 'admin';
