-- Asignación de servicios por profesional
CREATE TABLE IF NOT EXISTS user_services (
    user_id INT NOT NULL,
    service_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, service_id),
    KEY idx_user_services_service (service_id),
    CONSTRAINT fk_user_services_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_services_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Asignar todos los servicios activos al usuario profesional por defecto (si no tiene ninguno)
INSERT INTO user_services (user_id, service_id)
SELECT u.id, s.id
FROM users u
CROSS JOIN services s
WHERE u.username = 'profesional'
  AND u.role = 'profesional'
  AND s.active = 1
  AND NOT EXISTS (
      SELECT 1 FROM user_services us WHERE us.user_id = u.id
  );
