<?php

require_once __DIR__ . '/../config/site_settings.php';
require_once __DIR__ . '/../utils/Mailer.php';
require_once __DIR__ . '/../utils/GoogleCalendar.php';

function handleSettings($path, $method, $input, $authUser = null) {
    $db = getDB();
    ensureSiteSettingsSchema($db);

    if ($path === '/settings' && $method === 'GET') {
        $payload = getAdminSettingsPayload($db);
        $payload['google_calendar'] = array_merge(
            $payload['google_calendar'],
            getGoogleCalendarOAuthInfo()
        );
        jsonResponse($payload);
    }

    if ($path === '/settings' && $method === 'PUT') {
        updateSettingsSection($db, $input);
        $payload = getAdminSettingsPayload($db);
        $payload['google_calendar'] = array_merge(
            $payload['google_calendar'],
            getGoogleCalendarOAuthInfo()
        );
        jsonResponse([
            'message' => 'Configuración guardada',
            'settings' => $payload,
        ]);
    }

    if ($path === '/settings/test-email' && $method === 'POST') {
        testSettingsEmail($input);
    }

    if ($path === '/settings/test-google-calendar' && $method === 'POST') {
        testGoogleCalendarConnection($db);
    }

    if ($path === '/settings/google-calendar/auth-url' && $method === 'POST') {
        getGoogleCalendarAuthUrl($db, (int) ($authUser['userId'] ?? 0), $input);
    }

    if ($path === '/settings/google-calendar/calendars' && $method === 'GET') {
        listGoogleCalendars($db);
    }

    if ($path === '/settings/google-calendar/disconnect' && $method === 'POST') {
        disconnectGoogleCalendar($db);
    }

    jsonResponse(['error' => 'Not found'], 404);
}

function testSettingsEmail($input) {
    $to = trim($input['to'] ?? '');
    if (!$to || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['error' => 'Indica un correo válido para la prueba'], 400);
    }

    $result = sendTestEmail($to);
    if (!$result['sent']) {
        jsonResponse(['error' => $result['reason'] ?? 'No se pudo enviar el correo de prueba'], 400);
    }

    jsonResponse(['ok' => true, 'message' => $result['message'] ?? 'Correo de prueba enviado correctamente']);
}
