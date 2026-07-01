-- Migración: estatus no_show y columnas de recordatorios
ALTER TABLE appointments
  MODIFY COLUMN status ENUM('pending','confirmed','cancelled','completed','no_show') NOT NULL DEFAULT 'pending';

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS client_reminder_sent_at DATETIME NULL DEFAULT NULL AFTER status,
  ADD COLUMN IF NOT EXISTS professional_reminder_sent_at DATETIME NULL DEFAULT NULL AFTER client_reminder_sent_at;

INSERT INTO site_settings (setting_key, setting_value) VALUES
  ('mail_send_reminder_emails', '1'),
  ('mail_tpl_reminder_subject', 'Recordatorio: tu cita es mañana - {business_name}'),
  ('mail_tpl_reminder_heading', 'Tu cita es mañana'),
  ('mail_tpl_reminder_message', 'Hola {client_name}, te recordamos que tienes cita mañana. Estos son los detalles:'),
  ('mail_tpl_reminder_professional_subject', 'Recordatorio: cita mañana con {client_name}'),
  ('mail_tpl_reminder_professional_heading', 'Tienes una cita mañana'),
  ('mail_tpl_reminder_professional_message', 'Mañana atenderás a {client_name}. Revisa los detalles de la cita:')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
