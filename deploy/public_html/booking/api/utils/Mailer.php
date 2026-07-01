<?php

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/site_settings.php';

function getMailConfig() {
    static $config = null;
    if ($config === null) {
        $config = getEffectiveMailConfig(getDB());
    }
    return $config;
}

function createMailer() {
    $config = getMailConfig();
    $mail = new PHPMailer(true);
    $mail->CharSet = 'UTF-8';
    $mail->isSMTP();
    $mail->Host = $config['smtp_host'];
    $mail->Port = (int) $config['smtp_port'];
    $mail->SMTPAuth = true;
    $mail->Username = $config['smtp_user'];
    $mail->Password = $config['smtp_pass'];
    $mail->SMTPSecure = $config['smtp_secure'];
    $mail->SMTPDebug = (int) ($config['smtp_debug'] ?? 0);
    $mail->setFrom($config['email_from'], $config['email_from_name']);
    $mail->isHTML(true);

    return $mail;
}

function isMailConfigured() {
    $config = getMailConfig();
    return !empty($config['mail_enabled']) && !empty($config['smtp_user']) && !empty($config['smtp_pass']);
}

function getContactConfig($fresh = false) {
    static $contact = null;
    if ($fresh || $contact === null) {
        $contact = getEffectiveContactConfig(getDB());
    }
    return $contact;
}

function getWhatsAppContactInfo(array $contact) {
    $number = preg_replace('/\D+/', '', $contact['whatsapp_number'] ?? '');
    $display = trim($contact['whatsapp_display'] ?? '');

    if ($display === '' && $number !== '') {
        $display = $number;
    }

    $url = trim($contact['whatsapp_url'] ?? '');
    if ($url === '' && $number !== '') {
        $url = 'https://wa.me/' . $number;
    }

    return [
        'number' => $number,
        'display' => $display,
        'url' => $url,
        'has_whatsapp' => $display !== '' || $number !== '',
    ];
}

function formatBookingDate($date) {
    $timestamp = strtotime($date . 'T12:00:00');
    $days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    $months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    $dayName = $days[(int) date('w', $timestamp)];
    $day = date('j', $timestamp);
    $month = $months[(int) date('n', $timestamp) - 1];
    $year = date('Y', $timestamp);

    return "$dayName $day de $month de $year";
}

function formatBookingTime($time) {
    $parts = explode(':', $time);
    return sprintf('%02d:%02d', (int) $parts[0], (int) ($parts[1] ?? 0));
}

function getLogoPath() {
    $path = __DIR__ . '/../assets/tapai_logo.png';
    return file_exists($path) ? $path : null;
}

function getMailTemplates($db = null) {
    if (!$db) {
        $db = getDB();
    }

    return getMailTemplateSettings($db);
}

function renderMailTemplate($template, array $vars) {
    $search = [];
    $replace = [];

    foreach ($vars as $key => $value) {
        $search[] = '{' . $key . '}';
        $replace[] = (string) $value;
    }

    return strtr($template, array_combine($search, $replace));
}

function getAppointmentTemplateVars(array $appointment, array $contact, array $whatsapp) {
    $price = isset($appointment['service_price']) && $appointment['service_price'] !== ''
        ? '$' . number_format((float) $appointment['service_price'], 2)
        : '';
    $status = $appointment['status'] ?? '';

    return [
        'first_name' => getClientFirstName($appointment),
        'client_name' => getClientDisplayName($appointment),
        'business_name' => $contact['business_name'] ?? 'Tapai',
        'whatsapp' => $whatsapp['display'] ?? '',
        'whatsapp_url' => $whatsapp['url'] ?? '',
        'service_name' => $appointment['service_name'] ?? 'Servicio',
        'date' => formatBookingDate($appointment['appointment_date']),
        'time' => formatBookingTime($appointment['appointment_time']),
        'duration' => (string) (int) ($appointment['duration_minutes'] ?? 60),
        'price' => $price,
        'status' => $status,
        'status_label' => getStatusLabelEs($status),
        'professional_name' => trim($appointment['professional_name'] ?? '') ?: 'Profesional',
    ];
}

function getStatusLabelEs($status) {
    $labels = [
        'pending' => 'Pendiente',
        'confirmed' => 'Confirmada',
        'cancelled' => 'Cancelada',
        'completed' => 'Completada',
        'no_show' => 'No llegó',
    ];

    return $labels[$status] ?? $status;
}

function isStatusNotificationEnabled($status, $db = null) {
    if (!in_array($status, getMailNotifiableStatuses(), true)) {
        return false;
    }

    if (!$db) {
        $db = getDB();
    }

    $settings = getSiteSettings($db, ['mail_enabled', 'mail_notify_status_' . $status]);
    if (($settings['mail_enabled'] ?? '1') !== '1') {
        return false;
    }

    return ($settings['mail_notify_status_' . $status] ?? '0') === '1';
}

function fetchAppointmentForEmail($appointmentId, $db = null) {
    if (!$db) {
        $db = getDB();
    }

    $stmt = $db->prepare(
        "SELECT a.*, s.name AS service_name, s.price AS service_price,
                c.name AS client_name, c.email AS client_email, c.phone AS client_phone,
                u.full_name AS professional_name, u.email AS professional_email
         FROM appointments a
         LEFT JOIN services s ON a.service_id = s.id
         LEFT JOIN clients c ON a.client_id = c.id
         LEFT JOIN users u ON u.id = a.professional_id AND u.role = 'profesional' AND u.active = 1
         WHERE a.id = ?"
    );
    $stmt->execute([(int) $appointmentId]);

    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

function getStatusEmailTheme($status) {
    $themes = [
        'confirmed' => ['from' => '#7d7f3e', 'to' => '#aaa66a'],
        'cancelled' => ['from' => '#8b5e5e', 'to' => '#b88989'],
        'completed' => ['from' => '#5e7d6a', 'to' => '#89b89a'],
    ];

    return $themes[$status] ?? $themes['confirmed'];
}

function isProfessionalNotificationEnabled($db = null) {
    if (!$db) {
        $db = getDB();
    }

    $settings = getSiteSettings($db, ['mail_send_professional_notification']);
    return ($settings['mail_send_professional_notification'] ?? '1') === '1';
}

function getProfessionalEmail(array $appointment) {
    return trim($appointment['professional_email'] ?? '');
}

function hasAssignedProfessional(array $appointment) {
    return !empty($appointment['professional_id']) && getProfessionalEmail($appointment) !== '';
}

function isAdminNotificationEnabled($db = null) {
    if (!$db) {
        $db = getDB();
    }

    $settings = getSiteSettings($db, ['mail_send_admin_notification']);
    return ($settings['mail_send_admin_notification'] ?? '1') === '1';
}

function getSampleAppointmentForPreview($email) {
    return [
        'client_name' => 'María López',
        'client_email' => $email,
        'client_phone' => '771 123 4567',
        'service_name' => 'Masaje terapéutico',
        'appointment_date' => date('Y-m-d', strtotime('+3 days')),
        'appointment_time' => '10:00:00',
        'duration_minutes' => 60,
        'service_price' => 850,
    ];
}

function attachLogo(PHPMailer $mail) {
    $path = getLogoPath();
    if (!$path) {
        return false;
    }

    $mail->addEmbeddedImage($path, 'tapai_logo', 'tapai_logo.png');
    return true;
}

function getClientDisplayName($appointment) {
    $name = trim($appointment['client_name'] ?? '');
    return $name !== '' ? $name : 'Cliente';
}

function getClientFirstName($appointment) {
    $name = trim($appointment['client_name'] ?? '');
    if ($name === '') {
        return 'Cliente';
    }

    $parts = preg_split('/\s+/u', $name);
    return $parts[0] ?: 'Cliente';
}

function buildConfirmationHtml($appointment) {
    return buildRichBookingEmailHtml($appointment, 'confirmation');
}

function buildConfirmationPlainText($appointment) {
    return buildRichBookingPlainText($appointment, 'confirmation');
}

function buildRichBookingEmailHtml($appointment, $templatePrefix = 'confirmation') {
    $contact = getContactConfig(true);
    $whatsapp = getWhatsAppContactInfo($contact);
    $templates = getMailTemplates();
    $vars = getAppointmentTemplateVars($appointment, $contact, $whatsapp);

    $businessName = htmlspecialchars($contact['business_name'], ENT_QUOTES, 'UTF-8');
    $whatsappDisplay = htmlspecialchars($whatsapp['display'], ENT_QUOTES, 'UTF-8');
    $whatsappUrl = htmlspecialchars($whatsapp['url'], ENT_QUOTES, 'UTF-8');
    $websiteUrl = htmlspecialchars(rtrim($contact['website_url'], '/'), ENT_QUOTES, 'UTF-8');
    $heading = htmlspecialchars(renderMailTemplate($templates[$templatePrefix . '_heading'], $vars), ENT_QUOTES, 'UTF-8');

    if ($templatePrefix === 'confirmed') {
        $subheading = 'Detalles de tu cita confirmada';
        $greeting = '';
        $intro = htmlspecialchars(renderMailTemplate($templates['confirmed_message'], $vars), ENT_QUOTES, 'UTF-8');
    } else {
        $subheading = htmlspecialchars(renderMailTemplate($templates['confirmation_subheading'], $vars), ENT_QUOTES, 'UTF-8');
        $greeting = htmlspecialchars(renderMailTemplate($templates['confirmation_greeting'], $vars), ENT_QUOTES, 'UTF-8');
        $intro = htmlspecialchars(renderMailTemplate($templates['confirmation_intro'], $vars), ENT_QUOTES, 'UTF-8');
    }

    $contactTitle = htmlspecialchars(renderMailTemplate($templates['confirmation_contact_title'], $vars), ENT_QUOTES, 'UTF-8');
    $contactText = htmlspecialchars(renderMailTemplate($templates['confirmation_contact_text'], $vars), ENT_QUOTES, 'UTF-8');
    $whatsappButton = htmlspecialchars(renderMailTemplate($templates['confirmation_whatsapp_button'], $vars), ENT_QUOTES, 'UTF-8');
    $serviceName = htmlspecialchars($appointment['service_name'] ?? 'Servicio', ENT_QUOTES, 'UTF-8');
    $professionalName = trim($appointment['professional_name'] ?? '');
    $dateFormatted = formatBookingDate($appointment['appointment_date']);
    $timeFormatted = formatBookingTime($appointment['appointment_time']);
    $duration = (int) ($appointment['duration_minutes'] ?? 60);
    $price = isset($appointment['service_price']) ? number_format((float) $appointment['service_price'], 2) : null;

    $professionalRow = $professionalName !== ''
        ? '<tr><td style="padding:8px 0;color:#737872;">Profesional</td><td style="padding:8px 0;font-weight:600;">' . htmlspecialchars($professionalName, ENT_QUOTES, 'UTF-8') . '</td></tr>'
        : '';

    $priceRow = $price !== null
        ? '<tr><td style="padding:8px 0;color:#737872;">Precio</td><td style="padding:8px 0;font-weight:600;color:#7d7f3e;">$' . $price . '</td></tr>'
        : '';

    $whatsappRow = $whatsapp['has_whatsapp']
        ? '<tr><td style="padding:8px 0;color:#737872;">WhatsApp</td><td style="padding:8px 0;font-weight:600;"><a href="' . $whatsappUrl . '" style="color:#7d7f3e;text-decoration:none;">' . $whatsappDisplay . '</a></td></tr>'
        : '';

    $contactBlock = $whatsapp['has_whatsapp']
        ? <<<HTML
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;background:#eef2e3;border-radius:12px;padding:16px 20px;">
                <tr>
                  <td style="padding:0;color:#434843;font-size:14px;line-height:1.6;">
                    <strong>{$contactTitle}</strong><br>
                    {$contactText}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0 0;">
                    <a href="{$whatsappUrl}" style="display:inline-block;background:#7d7f3e;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:999px;">{$whatsappButton}</a>
                  </td>
                </tr>
              </table>
HTML
        : '<p style="margin:20px 0 0;color:#434843;font-size:14px;line-height:1.6;">Si necesitas hacer cambios o cancelar tu cita, contáctanos directamente con <strong>' . $businessName . '</strong>.</p>';

    $greetingBlock = $greeting !== ''
        ? '<p style="margin:0 0 16px;">' . $greeting . '</p>'
        : '';

    return <<<HTML
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f7f2ea;font-family:'DM Sans',Arial,sans-serif;color:#1c1c19;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f2ea;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:0;background:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding:24px 24px 0;line-height:0;font-size:0;mso-line-height-rule:exactly;">
                    <img src="cid:tapai_logo" alt="{$businessName}" width="200" height="60" style="display:block;margin:0 auto;width:200px;max-width:200px;height:auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;">
                  </td>
                </tr>
                <tr>
                  <td style="background:linear-gradient(135deg,#7d7f3e,#aaa66a);padding:16px 24px 24px;text-align:center;color:#ffffff;">
                    <h1 style="margin:0;font-size:24px;font-weight:500;line-height:1.3;">{$heading}</h1>
                    <p style="margin:8px 0 0;opacity:0.9;font-size:14px;line-height:1.4;">{$subheading}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              {$greetingBlock}
              <p style="margin:0 0 20px;color:#434843;">{$intro}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f2ea;border-radius:12px;padding:16px 20px;">
                <tr><td style="padding:8px 0;color:#737872;">Servicio</td><td style="padding:8px 0;font-weight:600;">{$serviceName}</td></tr>
                {$professionalRow}
                <tr><td style="padding:8px 0;color:#737872;">Fecha</td><td style="padding:8px 0;font-weight:600;">{$dateFormatted}</td></tr>
                <tr><td style="padding:8px 0;color:#737872;">Hora</td><td style="padding:8px 0;font-weight:600;">{$timeFormatted}</td></tr>
                <tr><td style="padding:8px 0;color:#737872;">Duración</td><td style="padding:8px 0;font-weight:600;">{$duration} min</td></tr>
                {$priceRow}
                {$whatsappRow}
              </table>
              {$contactBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px;text-align:center;color:#737872;font-size:12px;">
              {$businessName} · {$websiteUrl}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
HTML;
}

function buildRichBookingPlainText($appointment, $templatePrefix = 'confirmation') {
    $contact = getContactConfig(true);
    $whatsapp = getWhatsAppContactInfo($contact);
    $templates = getMailTemplates();
    $vars = getAppointmentTemplateVars($appointment, $contact, $whatsapp);
    $businessName = $contact['business_name'];
    $websiteUrl = rtrim($contact['website_url'], '/');
    $serviceName = $appointment['service_name'] ?? 'Servicio';
    $professionalName = trim($appointment['professional_name'] ?? '');
    $dateFormatted = formatBookingDate($appointment['appointment_date']);
    $timeFormatted = formatBookingTime($appointment['appointment_time']);
    $duration = (int) ($appointment['duration_minutes'] ?? 60);
    $price = isset($appointment['service_price']) ? '$' . number_format((float) $appointment['service_price'], 2) : null;

    if ($templatePrefix === 'confirmed') {
        $lines = [
            renderMailTemplate($templates['confirmed_heading'], $vars),
            '',
            renderMailTemplate($templates['confirmed_message'], $vars),
            '',
            "Servicio: {$serviceName}",
        ];
    } else {
        $lines = [
            renderMailTemplate($templates['confirmation_heading'], $vars),
            renderMailTemplate($templates['confirmation_subheading'], $vars),
            '',
            renderMailTemplate($templates['confirmation_greeting'], $vars),
            '',
            renderMailTemplate($templates['confirmation_intro'], $vars),
            "Servicio: {$serviceName}",
        ];
    }

    if ($professionalName !== '') {
        $lines[] = "Profesional: {$professionalName}";
    }

    $lines[] = "Fecha: {$dateFormatted}";
    $lines[] = "Hora: {$timeFormatted}";
    $lines[] = "Duración: {$duration} min";

    if ($price !== null) {
        $lines[] = "Precio: {$price}";
    }

    if ($whatsapp['has_whatsapp']) {
        $lines[] = "WhatsApp: {$whatsapp['display']}";
        $lines[] = "Enlace WhatsApp: {$whatsapp['url']}";
    }

    $lines[] = '';
    if ($whatsapp['has_whatsapp']) {
        $lines[] = renderMailTemplate($templates['confirmation_contact_title'], $vars);
        $lines[] = renderMailTemplate($templates['confirmation_contact_text'], $vars);
        $lines[] = 'Enlace WhatsApp: ' . $whatsapp['url'];
    } else {
        $lines[] = "Si necesitas cambiar o cancelar tu cita, contáctanos directamente con {$businessName}.";
    }
    $lines[] = '';
    $lines[] = "{$businessName} · {$websiteUrl}";

    return implode("\n", $lines);
}

function sendRichBookingEmail($appointment, $templatePrefix = 'confirmation') {
    $config = getMailConfig();
    $contact = getContactConfig(true);
    $email = trim($appointment['client_email'] ?? '');

    try {
        $mail = createMailer();
        $mail->addAddress($email, getClientDisplayName($appointment));
        $mail->addReplyTo($config['booking_reply_to'] ?: $config['email_from'], $config['email_from_name']);
        attachLogo($mail);
        $templates = getMailTemplates();
        $vars = getAppointmentTemplateVars($appointment, $contact, getWhatsAppContactInfo($contact));
        $subjectKey = $templatePrefix === 'confirmed' ? 'confirmed_subject' : 'confirmation_subject';
        $mail->Subject = renderMailTemplate($templates[$subjectKey], $vars);
        $mail->Body = buildRichBookingEmailHtml($appointment, $templatePrefix);
        $mail->AltBody = buildRichBookingPlainText($appointment, $templatePrefix);
        $mail->send();

        return ['sent' => true];
    } catch (Exception $e) {
        error_log('[Tapai Mail] Booking email failed: ' . $e->getMessage());
        return ['sent' => false, 'reason' => $e->getMessage()];
    }
}

function buildAdminNotificationHtml($appointment) {
    $contact = getContactConfig();
    $templates = getMailTemplates();
    $whatsapp = getWhatsAppContactInfo($contact);
    $vars = getAppointmentTemplateVars($appointment, $contact, $whatsapp);
    $businessName = htmlspecialchars($contact['business_name'], ENT_QUOTES, 'UTF-8');
    $heading = htmlspecialchars(renderMailTemplate($templates['admin_heading'], $vars), ENT_QUOTES, 'UTF-8');
    $clientName = htmlspecialchars($appointment['client_name'] ?? '', ENT_QUOTES, 'UTF-8');
    $clientEmail = htmlspecialchars($appointment['client_email'] ?? '', ENT_QUOTES, 'UTF-8');
    $clientPhone = htmlspecialchars($appointment['client_phone'] ?? '—', ENT_QUOTES, 'UTF-8');
    $serviceName = htmlspecialchars($appointment['service_name'] ?? '', ENT_QUOTES, 'UTF-8');
    $dateFormatted = formatBookingDate($appointment['appointment_date']);
    $timeFormatted = formatBookingTime($appointment['appointment_time']);

    return <<<HTML
<!DOCTYPE html>
<html lang="es">
<body style="font-family:'DM Sans',Arial,sans-serif;color:#1c1c19;background:#f7f2ea;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;">
    <div style="text-align:center;margin:0 0 16px;line-height:0;font-size:0;">
      <img src="cid:tapai_logo" alt="{$businessName}" width="180" height="54" style="display:block;margin:0 auto;width:180px;max-width:180px;height:auto;border:0;outline:none;text-decoration:none;">
    </div>
    <h2 style="color:#7d7f3e;margin:0 0 16px;">{$heading}</h2>
  <p><strong>Cliente:</strong> {$clientName}</p>
  <p><strong>Email:</strong> {$clientEmail}</p>
  <p><strong>Teléfono:</strong> {$clientPhone}</p>
  <p><strong>Servicio:</strong> {$serviceName}</p>
  <p><strong>Fecha:</strong> {$dateFormatted}</p>
  <p><strong>Hora:</strong> {$timeFormatted}</p>
  </div>
</body>
</html>
HTML;
}

function buildProfessionalNotificationHtml($appointment) {
    $contact = getContactConfig();
    $templates = getMailTemplates();
    $whatsapp = getWhatsAppContactInfo($contact);
    $vars = getAppointmentTemplateVars($appointment, $contact, $whatsapp);
    $businessName = htmlspecialchars($contact['business_name'], ENT_QUOTES, 'UTF-8');
    $heading = htmlspecialchars(renderMailTemplate($templates['professional_heading'], $vars), ENT_QUOTES, 'UTF-8');
    $clientName = htmlspecialchars($appointment['client_name'] ?? '', ENT_QUOTES, 'UTF-8');
    $clientEmail = htmlspecialchars($appointment['client_email'] ?? '', ENT_QUOTES, 'UTF-8');
    $clientPhone = htmlspecialchars($appointment['client_phone'] ?? '—', ENT_QUOTES, 'UTF-8');
    $serviceName = htmlspecialchars($appointment['service_name'] ?? '', ENT_QUOTES, 'UTF-8');
    $dateFormatted = formatBookingDate($appointment['appointment_date']);
    $timeFormatted = formatBookingTime($appointment['appointment_time']);
    $notes = trim($appointment['notes'] ?? '');
    $notesRow = $notes !== ''
        ? '<p><strong>Notas:</strong> ' . htmlspecialchars($notes, ENT_QUOTES, 'UTF-8') . '</p>'
        : '';

    return <<<HTML
<!DOCTYPE html>
<html lang="es">
<body style="font-family:'DM Sans',Arial,sans-serif;color:#1c1c19;background:#f7f2ea;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;">
    <div style="text-align:center;margin:0 0 16px;line-height:0;font-size:0;">
      <img src="cid:tapai_logo" alt="{$businessName}" width="180" height="54" style="display:block;margin:0 auto;width:180px;max-width:180px;height:auto;border:0;outline:none;text-decoration:none;">
    </div>
    <h2 style="color:#7d7f3e;margin:0 0 16px;">{$heading}</h2>
  <p><strong>Cliente:</strong> {$clientName}</p>
  <p><strong>Email:</strong> {$clientEmail}</p>
  <p><strong>Teléfono:</strong> {$clientPhone}</p>
  <p><strong>Servicio:</strong> {$serviceName}</p>
  <p><strong>Fecha:</strong> {$dateFormatted}</p>
  <p><strong>Hora:</strong> {$timeFormatted}</p>
  {$notesRow}
  </div>
</body>
</html>
HTML;
}

function buildProfessionalStatusNotificationHtml($appointment, $status) {
    $contact = getContactConfig(true);
    $whatsapp = getWhatsAppContactInfo($contact);
    $templates = getMailTemplates();
    $appointment['status'] = $status;
    $vars = getAppointmentTemplateVars($appointment, $contact, $whatsapp);
    $businessName = htmlspecialchars($contact['business_name'], ENT_QUOTES, 'UTF-8');
    $heading = htmlspecialchars(renderMailTemplate($templates['professional_status_heading'], $vars), ENT_QUOTES, 'UTF-8');
    $message = htmlspecialchars(renderMailTemplate($templates['professional_status_message'], $vars), ENT_QUOTES, 'UTF-8');
    $clientName = htmlspecialchars($appointment['client_name'] ?? '', ENT_QUOTES, 'UTF-8');
    $clientEmail = htmlspecialchars($appointment['client_email'] ?? '', ENT_QUOTES, 'UTF-8');
    $clientPhone = htmlspecialchars($appointment['client_phone'] ?? '—', ENT_QUOTES, 'UTF-8');
    $serviceName = htmlspecialchars($appointment['service_name'] ?? '', ENT_QUOTES, 'UTF-8');
    $statusLabel = htmlspecialchars(getStatusLabelEs($status), ENT_QUOTES, 'UTF-8');
    $dateFormatted = formatBookingDate($appointment['appointment_date']);
    $timeFormatted = formatBookingTime($appointment['appointment_time']);

    return <<<HTML
<!DOCTYPE html>
<html lang="es">
<body style="font-family:'DM Sans',Arial,sans-serif;color:#1c1c19;background:#f7f2ea;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;">
    <div style="text-align:center;margin:0 0 16px;line-height:0;font-size:0;">
      <img src="cid:tapai_logo" alt="{$businessName}" width="180" height="54" style="display:block;margin:0 auto;width:180px;max-width:180px;height:auto;border:0;outline:none;text-decoration:none;">
    </div>
    <h2 style="color:#7d7f3e;margin:0 0 16px;">{$heading}</h2>
    <p style="margin:0 0 16px;">{$message}</p>
    <p><strong>Estatus:</strong> {$statusLabel}</p>
    <p><strong>Cliente:</strong> {$clientName}</p>
    <p><strong>Email:</strong> {$clientEmail}</p>
    <p><strong>Teléfono:</strong> {$clientPhone}</p>
    <p><strong>Servicio:</strong> {$serviceName}</p>
    <p><strong>Fecha:</strong> {$dateFormatted}</p>
    <p><strong>Hora:</strong> {$timeFormatted}</p>
  </div>
</body>
</html>
HTML;
}

function sendBookingConfirmationEmail($appointment) {
    if (!isMailConfigured()) {
        return ['sent' => false, 'reason' => 'mail_not_configured'];
    }

    $email = trim($appointment['client_email'] ?? '');
    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['sent' => false, 'reason' => 'invalid_client_email'];
    }

    $templatePrefix = ($appointment['status'] ?? '') === 'confirmed' ? 'confirmed' : 'confirmation';
    return sendRichBookingEmail($appointment, $templatePrefix);
}

function sendAdminBookingNotification($appointment) {
    $config = getMailConfig();
    $adminEmail = trim($config['admin_email'] ?? '');
    if (!isMailConfigured() || ($adminEmail === '' || !filter_var($adminEmail, FILTER_VALIDATE_EMAIL))) {
        return ['sent' => false, 'reason' => 'mail_not_configured'];
    }

    if (!isAdminNotificationEnabled()) {
        return ['sent' => false, 'reason' => 'admin_notification_disabled'];
    }

    try {
        $mail = createMailer();
        $mail->addAddress($adminEmail);
        attachLogo($mail);
        $templates = getMailTemplates();
        $contact = getContactConfig();
        $vars = getAppointmentTemplateVars($appointment, $contact, getWhatsAppContactInfo($contact));
        $mail->Subject = renderMailTemplate($templates['admin_subject'], $vars);
        $mail->Body = buildAdminNotificationHtml($appointment);
        $mail->AltBody = strip_tags($mail->Body);
        $mail->send();

        return ['sent' => true];
    } catch (Exception $e) {
        error_log('[Tapai Mail] Admin notification failed: ' . $e->getMessage());
        return ['sent' => false, 'reason' => $e->getMessage()];
    }
}

function sendProfessionalBookingNotification($appointment) {
    if (!isMailConfigured()) {
        return ['sent' => false, 'reason' => 'mail_not_configured'];
    }

    if (!isProfessionalNotificationEnabled()) {
        return ['sent' => false, 'reason' => 'professional_notification_disabled'];
    }

    if (empty($appointment['professional_id'])) {
        return ['sent' => false, 'reason' => 'no_professional_assigned'];
    }

    $email = getProfessionalEmail($appointment);
    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['sent' => false, 'reason' => 'invalid_professional_email'];
    }

    try {
        $mail = createMailer();
        $professionalName = trim($appointment['professional_name'] ?? '') ?: 'Profesional';
        $mail->addAddress($email, $professionalName);
        attachLogo($mail);
        $templates = getMailTemplates();
        $contact = getContactConfig();
        $vars = getAppointmentTemplateVars($appointment, $contact, getWhatsAppContactInfo($contact));
        $mail->Subject = renderMailTemplate($templates['professional_subject'], $vars);
        $mail->Body = buildProfessionalNotificationHtml($appointment);
        $mail->AltBody = strip_tags($mail->Body);
        $mail->send();

        return ['sent' => true];
    } catch (Exception $e) {
        error_log('[Tapai Mail] Professional notification failed: ' . $e->getMessage());
        return ['sent' => false, 'reason' => $e->getMessage()];
    }
}

function sendProfessionalStatusNotification($appointment, $status) {
    if (!isMailConfigured() || !isStatusNotificationEnabled($status)) {
        return ['sent' => false, 'reason' => 'notification_disabled'];
    }

    if (!isProfessionalNotificationEnabled()) {
        return ['sent' => false, 'reason' => 'professional_notification_disabled'];
    }

    if (empty($appointment['professional_id'])) {
        return ['sent' => false, 'reason' => 'no_professional_assigned'];
    }

    $email = getProfessionalEmail($appointment);
    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['sent' => false, 'reason' => 'invalid_professional_email'];
    }

    try {
        $mail = createMailer();
        $professionalName = trim($appointment['professional_name'] ?? '') ?: 'Profesional';
        $mail->addAddress($email, $professionalName);
        attachLogo($mail);
        $templates = getMailTemplates();
        $contact = getContactConfig(true);
        $appointment['status'] = $status;
        $vars = getAppointmentTemplateVars($appointment, $contact, getWhatsAppContactInfo($contact));
        $mail->Subject = renderMailTemplate($templates['professional_status_subject'], $vars);
        $mail->Body = buildProfessionalStatusNotificationHtml($appointment, $status);
        $mail->AltBody = strip_tags($mail->Body);
        $mail->send();

        return ['sent' => true];
    } catch (Exception $e) {
        error_log('[Tapai Mail] Professional status notification failed: ' . $e->getMessage());
        return ['sent' => false, 'reason' => $e->getMessage()];
    }
}

function getClientPortalLoginUrl() {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';

    return $scheme . '://' . $host . '/booking/admin-dist/login';
}

function buildClientAccessEmailHtml(array $client, $username, $password) {
    $contact = getContactConfig(true);
    $businessName = htmlspecialchars($contact['business_name'] ?? 'Tapai', ENT_QUOTES, 'UTF-8');
    $clientName = htmlspecialchars(trim($client['name'] ?? '') ?: 'Paciente', ENT_QUOTES, 'UTF-8');
    $usernameSafe = htmlspecialchars($username, ENT_QUOTES, 'UTF-8');
    $passwordSafe = htmlspecialchars($password, ENT_QUOTES, 'UTF-8');
    $loginUrl = htmlspecialchars(getClientPortalLoginUrl(), ENT_QUOTES, 'UTF-8');
    $websiteUrl = htmlspecialchars($contact['website_url'] ?? '', ENT_QUOTES, 'UTF-8');

    return <<<HTML
<!DOCTYPE html>
<html lang="es">
<body style="font-family:'DM Sans',Arial,sans-serif;color:#1c1c19;background:#f7f2ea;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;">
    <div style="text-align:center;margin:0 0 16px;line-height:0;font-size:0;">
      <img src="cid:tapai_logo" alt="{$businessName}" width="180" height="54" style="display:block;margin:0 auto;width:180px;max-width:180px;height:auto;border:0;outline:none;text-decoration:none;">
    </div>
    <h2 style="color:#7d7f3e;margin:0 0 16px;">Tu acceso al historial clínico</h2>
    <p>Hola {$clientName},</p>
    <p>Te compartimos tus datos de acceso para consultar tu historial clínico y citas en {$businessName}.</p>
    <div style="background:#f7f2ea;border-radius:10px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px;"><strong>Usuario:</strong> {$usernameSafe}</p>
      <p style="margin:0 0 8px;"><strong>Contraseña:</strong> {$passwordSafe}</p>
      <p style="margin:0;"><strong>Enlace de acceso:</strong> <a href="{$loginUrl}" style="color:#7d7f3e;">{$loginUrl}</a></p>
    </div>
    <p>Te recomendamos cambiar tu contraseña después del primer inicio de sesión.</p>
    <p style="margin-top:24px;color:#666;font-size:14px;">{$businessName} · {$websiteUrl}</p>
  </div>
</body>
</html>
HTML;
}

function buildClientAccessPlainText(array $client, $username, $password) {
    $contact = getContactConfig(true);
    $businessName = $contact['business_name'] ?? 'Tapai';
    $clientName = trim($client['name'] ?? '') ?: 'Paciente';
    $loginUrl = getClientPortalLoginUrl();

    return implode("\n", [
        "Hola {$clientName},",
        '',
        "Te compartimos tus datos de acceso para consultar tu historial clínico en {$businessName}.",
        '',
        "Usuario: {$username}",
        "Contraseña: {$password}",
        "Enlace de acceso: {$loginUrl}",
        '',
        'Te recomendamos cambiar tu contraseña después del primer inicio de sesión.',
        '',
        "{$businessName} · " . ($contact['website_url'] ?? ''),
    ]);
}

function sendClientAccessEmail(array $client, $username, $password) {
    if (!isMailConfigured()) {
        return ['sent' => false, 'reason' => 'mail_not_configured'];
    }

    $email = trim($client['email'] ?? '');
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['sent' => false, 'reason' => 'invalid_client_email'];
    }

    try {
        $mail = createMailer();
        $config = getMailConfig();
        $contact = getContactConfig(true);
        $businessName = $contact['business_name'] ?? 'Tapai';
        $clientName = trim($client['name'] ?? '') ?: 'Paciente';

        $mail->addAddress($email, $clientName);
        if (!empty($config['booking_reply_to'])) {
            $mail->addReplyTo($config['booking_reply_to'], $config['email_from_name']);
        }
        attachLogo($mail);
        $mail->Subject = "Tus accesos a {$businessName}";
        $mail->Body = buildClientAccessEmailHtml($client, $username, $password);
        $mail->AltBody = buildClientAccessPlainText($client, $username, $password);
        $mail->send();

        return ['sent' => true];
    } catch (Exception $e) {
        error_log('[Tapai Mail] Client access email failed: ' . $e->getMessage());
        return ['sent' => false, 'reason' => $e->getMessage()];
    }
}

function sendTestEmail($to) {
    if (!isMailConfigured()) {
        return ['sent' => false, 'reason' => 'Configura SMTP en mail.php del servidor antes de probar'];
    }

    $sample = getSampleAppointmentForPreview($to);

    try {
        $mail = createMailer();
        $mail->addAddress($to);
        $mail->addReplyTo(getMailConfig()['booking_reply_to'] ?: getMailConfig()['email_from'], getMailConfig()['email_from_name']);
        attachLogo($mail);
        $contact = getContactConfig(true);
        $templates = getMailTemplates();
        $vars = getAppointmentTemplateVars($sample, $contact, getWhatsAppContactInfo($contact));
        $mail->Subject = '[Prueba] ' . renderMailTemplate($templates['confirmation_subject'], $vars);
        $mail->Body = buildConfirmationHtml($sample);
        $mail->AltBody = buildConfirmationPlainText($sample);
        $mail->send();

        return ['sent' => true, 'message' => 'Correo de prueba enviado con la plantilla de confirmación'];
    } catch (Exception $e) {
        return ['sent' => false, 'reason' => $e->getMessage()];
    }
}

function sendBookingEmails($appointment) {
    $clientResult = sendBookingConfirmationEmail($appointment);
    $adminResult = sendAdminBookingNotification($appointment);
    $professionalResult = sendProfessionalBookingNotification($appointment);

    return [
        'client' => $clientResult,
        'admin' => $adminResult,
        'professional' => $professionalResult,
    ];
}

function buildStatusChangeHtml($appointment, $status) {
    $contact = getContactConfig(true);
    $whatsapp = getWhatsAppContactInfo($contact);
    $templates = getMailTemplates();
    $vars = getAppointmentTemplateVars($appointment, $contact, $whatsapp);
    $theme = getStatusEmailTheme($status);

    $businessName = htmlspecialchars($contact['business_name'], ENT_QUOTES, 'UTF-8');
    $websiteUrl = htmlspecialchars(rtrim($contact['website_url'], '/'), ENT_QUOTES, 'UTF-8');
    $whatsappDisplay = htmlspecialchars($whatsapp['display'], ENT_QUOTES, 'UTF-8');
    $whatsappUrl = htmlspecialchars($whatsapp['url'], ENT_QUOTES, 'UTF-8');
    $heading = htmlspecialchars(renderMailTemplate($templates[$status . '_heading'], $vars), ENT_QUOTES, 'UTF-8');
    $message = htmlspecialchars(renderMailTemplate($templates[$status . '_message'], $vars), ENT_QUOTES, 'UTF-8');
    $serviceName = htmlspecialchars($appointment['service_name'] ?? 'Servicio', ENT_QUOTES, 'UTF-8');
    $statusLabel = htmlspecialchars(getStatusLabelEs($status), ENT_QUOTES, 'UTF-8');
    $dateFormatted = formatBookingDate($appointment['appointment_date']);
    $timeFormatted = formatBookingTime($appointment['appointment_time']);
    $duration = (int) ($appointment['duration_minutes'] ?? 60);
    $price = isset($appointment['service_price']) ? number_format((float) $appointment['service_price'], 2) : null;
    $gradient = $theme['from'] . ',' . $theme['to'];

    $priceRow = $price !== null
        ? '<tr><td style="padding:8px 0;color:#737872;">Precio</td><td style="padding:8px 0;font-weight:600;color:' . $theme['from'] . ';">$' . $price . '</td></tr>'
        : '';

    $whatsappBlock = ($status === 'cancelled' && $whatsapp['has_whatsapp'])
        ? '<p style="margin:20px 0 0;color:#434843;font-size:14px;line-height:1.6;">Si deseas reagendar, escríbenos por WhatsApp al <a href="' . $whatsappUrl . '" style="color:' . $theme['from'] . ';text-decoration:none;font-weight:600;">' . $whatsappDisplay . '</a>.</p>'
        : '';

    return <<<HTML
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f7f2ea;font-family:'DM Sans',Arial,sans-serif;color:#1c1c19;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f2ea;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:0;background:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding:24px 24px 0;line-height:0;font-size:0;mso-line-height-rule:exactly;">
                    <img src="cid:tapai_logo" alt="{$businessName}" width="200" height="60" style="display:block;margin:0 auto;width:200px;max-width:200px;height:auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;">
                  </td>
                </tr>
                <tr>
                  <td style="background:linear-gradient(135deg,{$gradient});padding:16px 24px 24px;text-align:center;color:#ffffff;">
                    <h1 style="margin:0;font-size:24px;font-weight:500;line-height:1.3;">{$heading}</h1>
                    <p style="margin:8px 0 0;opacity:0.9;font-size:14px;line-height:1.4;">Estatus: {$statusLabel}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              <p style="margin:0 0 20px;color:#434843;line-height:1.6;">{$message}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f2ea;border-radius:12px;padding:16px 20px;">
                <tr><td style="padding:8px 0;color:#737872;">Servicio</td><td style="padding:8px 0;font-weight:600;">{$serviceName}</td></tr>
                <tr><td style="padding:8px 0;color:#737872;">Fecha</td><td style="padding:8px 0;font-weight:600;">{$dateFormatted}</td></tr>
                <tr><td style="padding:8px 0;color:#737872;">Hora</td><td style="padding:8px 0;font-weight:600;">{$timeFormatted}</td></tr>
                <tr><td style="padding:8px 0;color:#737872;">Duración</td><td style="padding:8px 0;font-weight:600;">{$duration} min</td></tr>
                {$priceRow}
              </table>
              {$whatsappBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px;text-align:center;color:#737872;font-size:12px;">
              {$businessName} · {$websiteUrl}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
HTML;
}

function buildStatusChangePlainText($appointment, $status) {
    $contact = getContactConfig(true);
    $whatsapp = getWhatsAppContactInfo($contact);
    $templates = getMailTemplates();
    $vars = getAppointmentTemplateVars($appointment, $contact, $whatsapp);
    $businessName = $contact['business_name'];
    $websiteUrl = rtrim($contact['website_url'], '/');
    $serviceName = $appointment['service_name'] ?? 'Servicio';
    $dateFormatted = formatBookingDate($appointment['appointment_date']);
    $timeFormatted = formatBookingTime($appointment['appointment_time']);
    $duration = (int) ($appointment['duration_minutes'] ?? 60);
    $price = isset($appointment['service_price']) ? '$' . number_format((float) $appointment['service_price'], 2) : null;

    $lines = [
        renderMailTemplate($templates[$status . '_heading'], $vars),
        'Estatus: ' . getStatusLabelEs($status),
        '',
        renderMailTemplate($templates[$status . '_message'], $vars),
        '',
        "Servicio: {$serviceName}",
        "Fecha: {$dateFormatted}",
        "Hora: {$timeFormatted}",
        "Duración: {$duration} min",
    ];

    if ($price !== null) {
        $lines[] = "Precio: {$price}";
    }

    if ($status === 'cancelled' && $whatsapp['has_whatsapp']) {
        $lines[] = "WhatsApp: {$whatsapp['display']}";
        $lines[] = "Enlace WhatsApp: {$whatsapp['url']}";
    }

    $lines[] = '';
    $lines[] = "{$businessName} · {$websiteUrl}";

    return implode("\n", $lines);
}

function sendClientStatusEmail(array $appointment, $status) {
    $email = trim($appointment['client_email'] ?? '');
    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['sent' => false, 'reason' => 'invalid_client_email'];
    }

    $appointment['status'] = $status;

    try {
        $mail = createMailer();
        $config = getMailConfig();
        $contact = getContactConfig(true);
        $whatsapp = getWhatsAppContactInfo($contact);
        $templates = getMailTemplates();
        $vars = getAppointmentTemplateVars($appointment, $contact, $whatsapp);

        $mail->addAddress($email, getClientDisplayName($appointment));
        $mail->addReplyTo($config['booking_reply_to'] ?: $config['email_from'], $config['email_from_name']);
        attachLogo($mail);
        $mail->Subject = renderMailTemplate($templates[$status . '_subject'], $vars);
        $mail->Body = buildStatusChangeHtml($appointment, $status);
        $mail->AltBody = buildStatusChangePlainText($appointment, $status);
        $mail->send();

        return ['sent' => true];
    } catch (Exception $e) {
        error_log('[Tapai Mail] Client status email failed: ' . $e->getMessage());
        return ['sent' => false, 'reason' => $e->getMessage()];
    }
}

function sendAppointmentStatusEmail($appointmentId, $status) {
    if (!isMailConfigured() || !isStatusNotificationEnabled($status)) {
        return ['sent' => false, 'reason' => 'notification_disabled'];
    }

    $appointment = fetchAppointmentForEmail($appointmentId);
    if (!$appointment) {
        return ['sent' => false, 'reason' => 'appointment_not_found'];
    }

    $clientResult = sendClientStatusEmail($appointment, $status);
    if (!$clientResult['sent']) {
        return $clientResult;
    }

    $professionalResult = sendProfessionalStatusNotification($appointment, $status);

    return [
        'sent' => true,
        'client' => $clientResult,
        'professional' => $professionalResult,
    ];
}

function isReminderNotificationEnabled($db = null) {
    if (!$db) {
        $db = getDB();
    }

    $settings = getSiteSettings($db, ['mail_enabled', 'mail_send_reminder_emails']);
    if (($settings['mail_enabled'] ?? '1') !== '1') {
        return false;
    }

    return ($settings['mail_send_reminder_emails'] ?? '1') === '1';
}

function buildReminderHtml(array $appointment, $audience = 'client') {
    $contact = getContactConfig(true);
    $whatsapp = getWhatsAppContactInfo($contact);
    $templates = getMailTemplates();
    $vars = getAppointmentTemplateVars($appointment, $contact, $whatsapp);
    $prefix = $audience === 'professional' ? 'reminder_professional_' : 'reminder_';

    $businessName = htmlspecialchars($contact['business_name'], ENT_QUOTES, 'UTF-8');
    $heading = htmlspecialchars(renderMailTemplate($templates[$prefix . 'heading'], $vars), ENT_QUOTES, 'UTF-8');
    $message = htmlspecialchars(renderMailTemplate($templates[$prefix . 'message'], $vars), ENT_QUOTES, 'UTF-8');
    $serviceName = htmlspecialchars($appointment['service_name'] ?? 'Servicio', ENT_QUOTES, 'UTF-8');
    $clientName = htmlspecialchars($appointment['client_name'] ?? '', ENT_QUOTES, 'UTF-8');
    $clientEmail = htmlspecialchars($appointment['client_email'] ?? '', ENT_QUOTES, 'UTF-8');
    $clientPhone = htmlspecialchars($appointment['client_phone'] ?? '—', ENT_QUOTES, 'UTF-8');
    $professionalName = htmlspecialchars(trim($appointment['professional_name'] ?? '') ?: 'Profesional', ENT_QUOTES, 'UTF-8');
    $dateFormatted = formatBookingDate($appointment['appointment_date']);
    $timeFormatted = formatBookingTime($appointment['appointment_time']);
    $duration = (int) ($appointment['duration_minutes'] ?? 60);

    $clientRows = $audience === 'professional'
        ? "<p><strong>Cliente:</strong> {$clientName}</p><p><strong>Email:</strong> {$clientEmail}</p><p><strong>Teléfono:</strong> {$clientPhone}</p>"
        : '';

    $professionalRow = $audience === 'client' && !empty($appointment['professional_name'])
        ? "<p><strong>Profesional:</strong> {$professionalName}</p>"
        : '';

    return <<<HTML
<!DOCTYPE html>
<html lang="es">
<body style="font-family:'DM Sans',Arial,sans-serif;color:#1c1c19;background:#f7f2ea;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;">
    <h2 style="color:#7d7f3e;margin:0 0 16px;">{$heading}</h2>
    <p style="margin:0 0 16px;">{$message}</p>
    {$clientRows}
    <p><strong>Servicio:</strong> {$serviceName}</p>
    {$professionalRow}
    <p><strong>Fecha:</strong> {$dateFormatted}</p>
    <p><strong>Hora:</strong> {$timeFormatted}</p>
    <p><strong>Duración:</strong> {$duration} min</p>
  </div>
</body>
</html>
HTML;
}

function sendClientReminderEmail(array $appointment) {
    if (!isMailConfigured() || !isReminderNotificationEnabled()) {
        return ['sent' => false, 'reason' => 'notification_disabled'];
    }

    $email = trim($appointment['client_email'] ?? '');
    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['sent' => false, 'reason' => 'invalid_client_email'];
    }

    try {
        $mail = createMailer();
        $config = getMailConfig();
        $contact = getContactConfig(true);
        $templates = getMailTemplates();
        $vars = getAppointmentTemplateVars($appointment, $contact, getWhatsAppContactInfo($contact));

        $mail->addAddress($email, getClientDisplayName($appointment));
        $mail->addReplyTo($config['booking_reply_to'] ?: $config['email_from'], $config['email_from_name']);
        attachLogo($mail);
        $mail->Subject = renderMailTemplate($templates['reminder_subject'], $vars);
        $mail->Body = buildReminderHtml($appointment, 'client');
        $mail->AltBody = strip_tags($mail->Body);
        $mail->send();

        return ['sent' => true];
    } catch (Exception $e) {
        error_log('[Tapai Mail] Client reminder failed: ' . $e->getMessage());
        return ['sent' => false, 'reason' => $e->getMessage()];
    }
}

function sendProfessionalReminderEmail(array $appointment) {
    if (!isMailConfigured() || !isReminderNotificationEnabled()) {
        return ['sent' => false, 'reason' => 'notification_disabled'];
    }

    if (empty($appointment['professional_id'])) {
        return ['sent' => false, 'reason' => 'no_professional_assigned'];
    }

    $email = getProfessionalEmail($appointment);
    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['sent' => false, 'reason' => 'invalid_professional_email'];
    }

    try {
        $mail = createMailer();
        $professionalName = trim($appointment['professional_name'] ?? '') ?: 'Profesional';
        $mail->addAddress($email, $professionalName);
        attachLogo($mail);
        $contact = getContactConfig(true);
        $templates = getMailTemplates();
        $vars = getAppointmentTemplateVars($appointment, $contact, getWhatsAppContactInfo($contact));
        $mail->Subject = renderMailTemplate($templates['reminder_professional_subject'], $vars);
        $mail->Body = buildReminderHtml($appointment, 'professional');
        $mail->AltBody = strip_tags($mail->Body);
        $mail->send();

        return ['sent' => true];
    } catch (Exception $e) {
        error_log('[Tapai Mail] Professional reminder failed: ' . $e->getMessage());
        return ['sent' => false, 'reason' => $e->getMessage()];
    }
}

function sendAppointmentReminderEmails(array $appointment) {
    return [
        'client' => sendClientReminderEmail($appointment),
        'professional' => sendProfessionalReminderEmail($appointment),
    ];
}

function processAppointmentReminders($db) {
    require_once __DIR__ . '/../config/schema_appointments.php';
    ensureAppointmentSchema($db);

    $tomorrow = date('Y-m-d', strtotime('+1 day'));
    $stmt = $db->prepare(
        "SELECT a.*, s.name AS service_name, s.price AS service_price,
                c.name AS client_name, c.email AS client_email, c.phone AS client_phone,
                u.full_name AS professional_name, u.email AS professional_email
         FROM appointments a
         LEFT JOIN services s ON a.service_id = s.id
         LEFT JOIN clients c ON a.client_id = c.id
         LEFT JOIN users u ON u.id = a.professional_id AND u.role = 'profesional' AND u.active = 1
         WHERE a.appointment_date = ?
           AND a.status IN ('pending', 'confirmed')
           AND (a.client_reminder_sent_at IS NULL OR a.professional_reminder_sent_at IS NULL)"
    );
    $stmt->execute([$tomorrow]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $summary = [
        'date' => $tomorrow,
        'processed' => 0,
        'client_sent' => 0,
        'professional_sent' => 0,
        'errors' => [],
    ];

    foreach ($rows as $appointment) {
        $summary['processed']++;
        $clientSentAt = $appointment['client_reminder_sent_at'] ?? null;
        $professionalSentAt = $appointment['professional_reminder_sent_at'] ?? null;
        $results = ['client' => ['sent' => false], 'professional' => ['sent' => false]];

        if (!$clientSentAt) {
            $results['client'] = sendClientReminderEmail($appointment);
            if ($results['client']['sent']) {
                $summary['client_sent']++;
                $db->prepare("UPDATE appointments SET client_reminder_sent_at = NOW() WHERE id = ?")
                    ->execute([(int) $appointment['id']]);
            } elseif (($results['client']['reason'] ?? '') !== 'invalid_client_email') {
                $summary['errors'][] = 'Cita #' . $appointment['id'] . ' cliente: ' . ($results['client']['reason'] ?? 'error');
            }
        }

        if (!$professionalSentAt) {
            $results['professional'] = sendProfessionalReminderEmail($appointment);
            if ($results['professional']['sent']) {
                $summary['professional_sent']++;
                $db->prepare("UPDATE appointments SET professional_reminder_sent_at = NOW() WHERE id = ?")
                    ->execute([(int) $appointment['id']]);
            } elseif (!in_array($results['professional']['reason'] ?? '', ['no_professional_assigned', 'invalid_professional_email'], true)) {
                $summary['errors'][] = 'Cita #' . $appointment['id'] . ' profesional: ' . ($results['professional']['reason'] ?? 'error');
            }
        }
    }

    return $summary;
}
