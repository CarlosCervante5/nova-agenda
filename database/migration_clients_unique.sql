-- Clientes únicos y perfil con rol cliente
-- Ejecutado automáticamente vía ensureClientSchema() en schema_clients.php

ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id INT NULL AFTER notes;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email_normalized VARCHAR(100) NULL AFTER email;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone_normalized VARCHAR(20) NULL AFTER phone;

-- Normalizar datos existentes (ejecutar antes de índices UNIQUE)
-- UPDATE clients SET email_normalized = LOWER(TRIM(email)), phone_normalized = REGEXP_REPLACE(phone, '[^0-9]', '');

-- ALTER TABLE users MODIFY role ENUM('admin','profesional','cliente') NOT NULL DEFAULT 'profesional';

-- CREATE UNIQUE INDEX idx_clients_email_normalized ON clients (email_normalized);
-- CREATE UNIQUE INDEX idx_clients_phone_normalized ON clients (phone_normalized);
-- CREATE UNIQUE INDEX idx_clients_user_id ON clients (user_id);
