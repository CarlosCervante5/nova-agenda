<?php

function ensureSiteSettingsSchema($db) {
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    $db->exec("CREATE TABLE IF NOT EXISTS site_settings (
        setting_key VARCHAR(100) NOT NULL,
        setting_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $stmt = $db->prepare("INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES (?, ?)");
    foreach (getDefaultSiteSettings() as $key => $value) {
        $stmt->execute([$key, (string) $value]);
    }

    applySiteSettingsMigrations($db);
}

function applySiteSettingsMigrations($db) {
    $stmt = $db->prepare("SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1");
    $stmt->execute(['migration_mail_templates_20250620']);
    if ($stmt->fetchColumn() === '1') {
        return;
    }

    $updates = [
        'mail_tpl_confirmation_subject' => 'Solicitud de cita recibida - {business_name}',
        'mail_tpl_confirmation_heading' => 'Se ha creado tu solicitud de cita',
        'mail_tpl_confirmation_subheading' => 'En breve confirmaremos tu cita',
        'mail_tpl_confirmation_intro' => 'Hemos recibido tu solicitud. Estos son los detalles:',
    ];

    $updateStmt = $db->prepare("UPDATE site_settings SET setting_value = ? WHERE setting_key = ?");
    foreach ($updates as $key => $value) {
        $updateStmt->execute([$value, $key]);
    }

    $db->prepare(
        "INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)"
    )->execute(['migration_mail_templates_20250620', '1']);
}

function getDefaultSiteSettings() {
    return [
        'business_name' => 'TAPAI Centro de Sanación',
        'website_url' => 'https://tapaicentro.com/',
        'whatsapp_number' => '527713793868',
        'whatsapp_display' => '771.379.3868',
        'contact_phone' => '',
        'contact_email' => 'booking@tapaicentro.com',
        'home_button_label' => 'Volver al inicio',
        'mail_enabled' => '1',
        'smtp_host' => '',
        'smtp_port' => '587',
        'smtp_secure' => 'tls',
        'smtp_user' => '',
        'smtp_pass' => '',
        'email_from' => '',
        'email_from_name' => 'Tapai Centro de Sanación',
        'admin_email' => '',
        'booking_reply_to' => '',
        'mail_send_admin_notification' => '1',
        'mail_send_professional_notification' => '1',
        'mail_send_reminder_emails' => '1',
        'mail_tpl_confirmation_subject' => 'Solicitud de cita recibida - {business_name}',
        'mail_tpl_confirmation_heading' => 'Se ha creado tu solicitud de cita',
        'mail_tpl_confirmation_subheading' => 'En breve confirmaremos tu cita',
        'mail_tpl_confirmation_greeting' => 'Hola {client_name},',
        'mail_tpl_confirmation_intro' => 'Hemos recibido tu solicitud. Estos son los detalles:',
        'mail_tpl_confirmation_contact_title' => '¿Necesitas cambiar o cancelar tu cita?',
        'mail_tpl_confirmation_contact_text' => 'Escríbenos por WhatsApp al {whatsapp}.',
        'mail_tpl_confirmation_whatsapp_button' => 'Contactar por WhatsApp',
        'mail_tpl_admin_subject' => 'Nueva cita de {client_name}',
        'mail_tpl_admin_heading' => 'Nueva cita de {client_name}',
        'mail_tpl_professional_subject' => 'Nueva cita en tu agenda - {client_name}',
        'mail_tpl_professional_heading' => 'Nueva cita asignada a ti',
        'mail_tpl_professional_status_subject' => 'Cita {status_label}: {client_name}',
        'mail_tpl_professional_status_heading' => 'Actualización de cita en tu agenda',
        'mail_tpl_professional_status_message' => 'La cita de {client_name} cambió a {status_label}.',
        'mail_tpl_reminder_subject' => 'Recordatorio: tu cita es mañana - {business_name}',
        'mail_tpl_reminder_heading' => 'Tu cita es mañana',
        'mail_tpl_reminder_message' => 'Hola {client_name}, te recordamos que tienes cita mañana. Estos son los detalles:',
        'mail_tpl_reminder_professional_subject' => 'Recordatorio: cita mañana con {client_name}',
        'mail_tpl_reminder_professional_heading' => 'Tienes una cita mañana',
        'mail_tpl_reminder_professional_message' => 'Mañana atenderás a {client_name}. Revisa los detalles de la cita:',
        'mail_notify_status_confirmed' => '1',
        'mail_notify_status_cancelled' => '1',
        'mail_notify_status_completed' => '0',
        'mail_tpl_confirmed_subject' => 'Tu cita ha sido confirmada - {business_name}',
        'mail_tpl_confirmed_heading' => 'Cita confirmada',
        'mail_tpl_confirmed_message' => 'Hola {client_name}, te confirmamos que tu cita quedó confirmada.',
        'mail_tpl_cancelled_subject' => 'Tu cita ha sido cancelada - {business_name}',
        'mail_tpl_cancelled_heading' => 'Cita cancelada',
        'mail_tpl_cancelled_message' => 'Hola {client_name}, tu cita ha sido cancelada. Si deseas reagendar, contáctanos por WhatsApp.',
        'mail_tpl_completed_subject' => 'Gracias por tu visita - {business_name}',
        'mail_tpl_completed_heading' => 'Cita completada',
        'mail_tpl_completed_message' => 'Hola {client_name}, gracias por asistir a tu cita. Esperamos verte pronto.',
        'google_calendar_enabled' => '0',
        'google_calendar_id' => 'primary',
        'google_client_id' => '',
        'google_client_secret' => '',
        'google_refresh_token' => '',
        'google_sync_on_booking' => '1',
    ];
}

function getSiteSettings($db, array $keys = null) {
    ensureSiteSettingsSchema($db);

    if ($keys) {
        $placeholders = implode(',', array_fill(0, count($keys), '?'));
        $stmt = $db->prepare("SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN ($placeholders)");
        $stmt->execute($keys);
    } else {
        $stmt = $db->query("SELECT setting_key, setting_value FROM site_settings");
    }

    $settings = getDefaultSiteSettings();
    foreach ($stmt->fetchAll() as $row) {
        $settings[$row['setting_key']] = $row['setting_value'];
    }

    return $settings;
}

function getPublicSiteSettings($db) {
    $settings = getSiteSettings($db, [
        'business_name',
        'website_url',
        'whatsapp_number',
        'whatsapp_display',
        'contact_phone',
        'contact_email',
        'home_button_label',
    ]);

    return [
        'business_name' => $settings['business_name'],
        'website_url' => rtrim($settings['website_url'], '/') . '/',
        'whatsapp_number' => preg_replace('/\D+/', '', $settings['whatsapp_number']),
        'whatsapp_display' => $settings['whatsapp_display'],
        'whatsapp_url' => 'https://wa.me/' . preg_replace('/\D+/', '', $settings['whatsapp_number']),
        'contact_phone' => $settings['contact_phone'],
        'contact_email' => $settings['contact_email'],
        'home_button_label' => $settings['home_button_label'],
    ];
}

function getContactSettings($db) {
    $settings = getSiteSettings($db, [
        'business_name',
        'website_url',
        'whatsapp_number',
        'whatsapp_display',
        'contact_phone',
        'contact_email',
        'home_button_label',
    ]);

    return array_intersect_key($settings, array_flip([
        'business_name',
        'website_url',
        'whatsapp_number',
        'whatsapp_display',
        'contact_phone',
        'contact_email',
        'home_button_label',
    ]));
}

function getMailNotifiableStatuses() {
    return ['confirmed', 'cancelled', 'completed'];
}

function getMailTemplateKeys() {
    $keys = [
        'confirmation_subject',
        'confirmation_heading',
        'confirmation_subheading',
        'confirmation_greeting',
        'confirmation_intro',
        'confirmation_contact_title',
        'confirmation_contact_text',
        'confirmation_whatsapp_button',
        'admin_subject',
        'admin_heading',
        'professional_subject',
        'professional_heading',
        'professional_status_subject',
        'professional_status_heading',
        'professional_status_message',
        'reminder_subject',
        'reminder_heading',
        'reminder_message',
        'reminder_professional_subject',
        'reminder_professional_heading',
        'reminder_professional_message',
    ];

    foreach (getMailNotifiableStatuses() as $status) {
        $keys[] = $status . '_subject';
        $keys[] = $status . '_heading';
        $keys[] = $status . '_message';
    }

    return $keys;
}

function getMailTemplateDbKey($name) {
    return 'mail_tpl_' . $name;
}

function getMailTemplateSettings($db) {
    $keys = getMailTemplateKeys();
    $dbKeys = array_map('getMailTemplateDbKey', $keys);
    $settings = getSiteSettings($db, $dbKeys);
    $defaults = getDefaultSiteSettings();
    $result = [];

    foreach ($keys as $key) {
        $dbKey = getMailTemplateDbKey($key);
        $result[$key] = $settings[$dbKey] ?? ($defaults[$dbKey] ?? '');
    }

    return $result;
}

function getAdminMailSettings($db) {
    $settings = getSiteSettings($db, array_merge([
        'mail_enabled',
        'admin_email',
        'mail_send_admin_notification',
        'mail_send_professional_notification',
        'mail_send_reminder_emails',
    ], array_map(function ($status) {
        return 'mail_notify_status_' . $status;
    }, getMailNotifiableStatuses())));

    $mail = [
        'mail_enabled' => ($settings['mail_enabled'] ?? '1') === '1',
        'admin_email' => $settings['admin_email'] ?? '',
        'send_admin_notification' => ($settings['mail_send_admin_notification'] ?? '1') === '1',
        'send_professional_notification' => ($settings['mail_send_professional_notification'] ?? '1') === '1',
        'send_reminder_emails' => ($settings['mail_send_reminder_emails'] ?? '1') === '1',
    ];

    foreach (getMailNotifiableStatuses() as $status) {
        $mail['notify_status_' . $status] = ($settings['mail_notify_status_' . $status] ?? '0') === '1';
    }

    return $mail;
}

function getMailSettings($db) {
    $settings = getSiteSettings($db, [
        'mail_enabled',
        'smtp_host',
        'smtp_port',
        'smtp_secure',
        'smtp_user',
        'smtp_pass',
        'email_from',
        'email_from_name',
        'admin_email',
        'booking_reply_to',
    ]);

    return array_intersect_key($settings, array_flip([
        'mail_enabled',
        'smtp_host',
        'smtp_port',
        'smtp_secure',
        'smtp_user',
        'smtp_pass',
        'email_from',
        'email_from_name',
        'admin_email',
        'booking_reply_to',
    ]));
}

function getGoogleOAuthCredentials() {
    static $credentials = null;

    if ($credentials !== null) {
        return $credentials;
    }

    if (file_exists(__DIR__ . '/google.php')) {
        require_once __DIR__ . '/google.php';
    }

    $credentials = [
        'google_client_id' => defined('GOOGLE_CLIENT_ID') ? trim((string) GOOGLE_CLIENT_ID) : '',
        'google_client_secret' => defined('GOOGLE_CLIENT_SECRET') ? trim((string) GOOGLE_CLIENT_SECRET) : '',
    ];

    return $credentials;
}

function isGoogleOAuthConfigured() {
    $oauth = getGoogleOAuthCredentials();

    return $oauth['google_client_id'] !== '' && $oauth['google_client_secret'] !== '';
}

function getGoogleCalendarSettings($db) {
    $settings = getSiteSettings($db, [
        'google_calendar_enabled',
        'google_calendar_id',
        'google_refresh_token',
        'google_sync_on_booking',
    ]);

    $settings = array_intersect_key($settings, array_flip([
        'google_calendar_enabled',
        'google_calendar_id',
        'google_refresh_token',
        'google_sync_on_booking',
    ]));

    return array_merge($settings, getGoogleOAuthCredentials());
}

function getAdminSettingsPayload($db) {
    $contact = getContactSettings($db);
    $google = getGoogleCalendarSettings($db);

    return [
        'contact' => $contact,
        'mail' => getAdminMailSettings($db),
        'mail_templates' => getMailTemplateSettings($db),
        'google_calendar' => sanitizeGoogleSettingsForResponse($google),
    ];
}

function sanitizeMailSettingsForResponse(array $mail) {
    $mail['mail_enabled'] = ($mail['mail_enabled'] ?? '1') === '1';
    $mail['smtp_pass_set'] = !empty($mail['smtp_pass']);
    unset($mail['smtp_pass']);
    return $mail;
}

function sanitizeGoogleSettingsForResponse(array $google) {
    $google['google_calendar_enabled'] = ($google['google_calendar_enabled'] ?? '0') === '1';
    $google['google_sync_on_booking'] = ($google['google_sync_on_booking'] ?? '1') === '1';
    $google['google_oauth_configured'] = isGoogleOAuthConfigured();
    $google['google_refresh_token_set'] = !empty($google['google_refresh_token']);
    $google['google_connected'] = !empty($google['google_refresh_token']);
    unset($google['google_client_id'], $google['google_client_secret'], $google['google_refresh_token']);
    return $google;
}

function updateSiteSettings($db, array $updates) {
    ensureSiteSettingsSchema($db);

    $allowed = array_keys(getDefaultSiteSettings());
    $stmt = $db->prepare("
        INSERT INTO site_settings (setting_key, setting_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
    ");

    foreach ($updates as $key => $value) {
        if (!in_array($key, $allowed, true)) {
            continue;
        }
        if ($value === null) {
            continue;
        }
        $stmt->execute([$key, (string) $value]);
    }
}

function updateSettingsSection($db, array $input) {
    $updates = [];

    if (isset($input['contact']) && is_array($input['contact'])) {
        foreach ($input['contact'] as $key => $value) {
            $updates[$key] = trim((string) $value);
        }
    }

    if (isset($input['mail']) && is_array($input['mail'])) {
        $mail = $input['mail'];
        if (array_key_exists('mail_enabled', $mail)) {
            $updates['mail_enabled'] = !empty($mail['mail_enabled']) ? '1' : '0';
        }
        if (array_key_exists('admin_email', $mail)) {
            $updates['admin_email'] = trim((string) $mail['admin_email']);
        }
        if (array_key_exists('send_admin_notification', $mail)) {
            $updates['mail_send_admin_notification'] = !empty($mail['send_admin_notification']) ? '1' : '0';
        }
        if (array_key_exists('send_professional_notification', $mail)) {
            $updates['mail_send_professional_notification'] = !empty($mail['send_professional_notification']) ? '1' : '0';
        }
        if (array_key_exists('send_reminder_emails', $mail)) {
            $updates['mail_send_reminder_emails'] = !empty($mail['send_reminder_emails']) ? '1' : '0';
        }
        foreach (getMailNotifiableStatuses() as $status) {
            $field = 'notify_status_' . $status;
            if (array_key_exists($field, $mail)) {
                $updates['mail_notify_status_' . $status] = !empty($mail[$field]) ? '1' : '0';
            }
        }
    }

    if (isset($input['mail_templates']) && is_array($input['mail_templates'])) {
        foreach ($input['mail_templates'] as $key => $value) {
            if (!in_array($key, getMailTemplateKeys(), true)) {
                continue;
            }
            $updates[getMailTemplateDbKey($key)] = trim((string) $value);
        }
    }

    if (isset($input['google_calendar']) && is_array($input['google_calendar'])) {
        $google = $input['google_calendar'];
        foreach (['google_calendar_enabled', 'google_sync_on_booking'] as $key) {
            if (array_key_exists($key, $google)) {
                $updates[$key] = !empty($google[$key]) ? '1' : '0';
            }
        }
        foreach (['google_calendar_id'] as $key) {
            if (array_key_exists($key, $google)) {
                $updates[$key] = trim((string) $google[$key]);
            }
        }
        if (!empty($google['google_refresh_token'])) {
            $updates['google_refresh_token'] = trim((string) $google['google_refresh_token']);
        }
    }

    if (!$updates) {
        return;
    }

    updateSiteSettings($db, $updates);
}

function getEffectiveMailConfig($db = null) {
    if (file_exists(__DIR__ . '/mail.php')) {
        require_once __DIR__ . '/mail.php';
    }

    $defaults = [
        'mail_enabled' => defined('MAIL_ENABLED') ? MAIL_ENABLED : false,
        'smtp_host' => defined('SMTP_HOST') ? SMTP_HOST : '',
        'smtp_port' => defined('SMTP_PORT') ? SMTP_PORT : 587,
        'smtp_secure' => defined('SMTP_SECURE') ? SMTP_SECURE : 'tls',
        'smtp_user' => defined('SMTP_USER') ? SMTP_USER : '',
        'smtp_pass' => defined('SMTP_PASS') ? SMTP_PASS : '',
        'email_from' => defined('EMAIL_FROM') ? EMAIL_FROM : '',
        'email_from_name' => defined('EMAIL_FROM_NAME') ? EMAIL_FROM_NAME : 'Tapai Centro de Sanación',
        'admin_email' => defined('ADMIN_EMAIL') ? ADMIN_EMAIL : '',
        'booking_reply_to' => defined('BOOKING_REPLY_TO') ? BOOKING_REPLY_TO : '',
        'smtp_debug' => defined('SMTP_DEBUG') ? SMTP_DEBUG : 0,
    ];

    if (!$db) {
        $db = getDB();
    }

    $stored = getMailSettings($db);

    foreach ($stored as $key => $value) {
        if ($key === 'mail_enabled') {
            $defaults['mail_enabled'] = $value === '1';
            continue;
        }
        if ($value !== '' && $value !== null) {
            $defaults[$key] = $value;
        }
    }

    if (empty($defaults['booking_reply_to'])) {
        $defaults['booking_reply_to'] = $defaults['email_from'];
    }

    if (empty($defaults['admin_email']) && !empty($defaults['email_from'])) {
        $defaults['admin_email'] = $defaults['email_from'];
    }

    return $defaults;
}

function getEffectiveContactConfig($db = null) {
    if (!$db) {
        $db = getDB();
    }

    return getPublicSiteSettings($db);
}
