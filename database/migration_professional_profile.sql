-- Perfil público de profesionales y citas por profesional

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_photo VARCHAR(255) NULL AFTER full_name,
  ADD COLUMN IF NOT EXISTS profile_bio TEXT NULL AFTER profile_photo,
  ADD COLUMN IF NOT EXISTS booking_slug VARCHAR(80) NULL AFTER profile_bio;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_booking_slug ON users (booking_slug);

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS professional_id INT NULL AFTER service_id;

ALTER TABLE appointments
  ADD KEY IF NOT EXISTS idx_appointments_professional (professional_id);
