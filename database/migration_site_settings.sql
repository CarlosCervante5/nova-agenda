-- Configuración del sitio (contacto, correo, Google Calendar)
CREATE TABLE IF NOT EXISTS site_settings (
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES
('business_name', 'TAPAI Centro de Sanación'),
('website_url', 'https://tapaicentro.com/'),
('whatsapp_number', '527713793868'),
('whatsapp_display', '771.379.3868'),
('contact_phone', ''),
('contact_email', 'booking@tapaicentro.com'),
('home_button_label', 'Volver al inicio'),
('mail_enabled', '1'),
('smtp_host', ''),
('smtp_port', '587'),
('smtp_secure', 'tls'),
('smtp_user', ''),
('smtp_pass', ''),
('email_from', ''),
('email_from_name', 'Tapai Centro de Sanación'),
('admin_email', ''),
('booking_reply_to', ''),
('mail_send_admin_notification', '1'),
('mail_tpl_confirmation_subject', 'Solicitud de cita recibida - {business_name}'),
('mail_tpl_confirmation_heading', 'Se ha creado tu solicitud de cita'),
('mail_tpl_confirmation_subheading', 'En breve confirmaremos tu cita'),
('mail_tpl_confirmation_greeting', 'Hola {client_name},'),
('mail_tpl_confirmation_intro', 'Hemos recibido tu solicitud. Estos son los detalles:'),
('mail_tpl_confirmation_contact_title', '¿Necesitas cambiar o cancelar tu cita?'),
('mail_tpl_confirmation_contact_text', 'Escríbenos por WhatsApp al {whatsapp}.'),
('mail_tpl_confirmation_whatsapp_button', 'Contactar por WhatsApp'),
('mail_tpl_admin_subject', 'Nueva cita de {client_name}'),
('mail_tpl_admin_heading', 'Nueva cita de {client_name}'),
('mail_notify_status_confirmed', '1'),
('mail_notify_status_cancelled', '1'),
('mail_notify_status_completed', '0'),
('mail_tpl_confirmed_subject', 'Tu cita ha sido confirmada - {business_name}'),
('mail_tpl_confirmed_heading', 'Cita confirmada'),
('mail_tpl_confirmed_message', 'Hola {client_name}, te confirmamos que tu cita quedó confirmada.'),
('mail_tpl_cancelled_subject', 'Tu cita ha sido cancelada - {business_name}'),
('mail_tpl_cancelled_heading', 'Cita cancelada'),
('mail_tpl_cancelled_message', 'Hola {client_name}, tu cita ha sido cancelada. Si deseas reagendar, contáctanos por WhatsApp.'),
('mail_tpl_completed_subject', 'Gracias por tu visita - {business_name}'),
('mail_tpl_completed_heading', 'Cita completada'),
('mail_tpl_completed_message', 'Hola {client_name}, gracias por asistir a tu cita. Esperamos verte pronto.'),
('google_calendar_enabled', '0'),
('google_calendar_id', 'primary'),
('google_client_id', ''),
('google_client_secret', ''),
('google_refresh_token', ''),
('google_sync_on_booking', '1');

-- Actualizar textos del correo inicial (solicitud de cita, no confirmación final)
UPDATE site_settings SET setting_value = 'Solicitud de cita recibida - {business_name}' WHERE setting_key = 'mail_tpl_confirmation_subject';
UPDATE site_settings SET setting_value = 'Se ha creado tu solicitud de cita' WHERE setting_key = 'mail_tpl_confirmation_heading';
UPDATE site_settings SET setting_value = 'En breve confirmaremos tu cita' WHERE setting_key = 'mail_tpl_confirmation_subheading';
UPDATE site_settings SET setting_value = 'Hemos recibido tu solicitud. Estos son los detalles:' WHERE setting_key = 'mail_tpl_confirmation_intro';
