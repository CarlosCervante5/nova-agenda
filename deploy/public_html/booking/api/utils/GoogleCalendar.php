<?php

require_once __DIR__ . '/../config/site_settings.php';
require_once __DIR__ . '/../config/app_paths.php';
require_once __DIR__ . '/../middleware/auth_v3.php';

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

function getGoogleOAuthRedirectUri() {
    return getAbsoluteUrl(getApiBasePath() . '/settings/google-calendar/callback');
}

function getGoogleAdminSettingsRedirectUri() {
    return getAbsoluteUrl(getAdminDistBasePath() . '/settings');
}

function createGoogleOAuthState($userId) {
    return JWT::encode([
        'purpose' => 'google_calendar_oauth',
        'userId' => (int) $userId,
    ]);
}

function validateGoogleOAuthState($state) {
    $payload = JWT::decode($state);
    if (!$payload || ($payload['purpose'] ?? '') !== 'google_calendar_oauth') {
        throw new Exception('Estado OAuth inválido o expirado');
    }

    return $payload;
}

function buildGoogleOAuthUrl(array $settings, $state) {
    $params = http_build_query([
        'client_id' => $settings['google_client_id'],
        'redirect_uri' => getGoogleOAuthRedirectUri(),
        'response_type' => 'code',
        'scope' => GOOGLE_CALENDAR_SCOPE,
        'access_type' => 'offline',
        'prompt' => 'consent',
        'include_granted_scopes' => 'true',
        'state' => $state,
    ]);

    return 'https://accounts.google.com/o/oauth2/v2/auth?' . $params;
}

function exchangeGoogleAuthCode(array $settings, $code) {
    $payload = http_build_query([
        'code' => $code,
        'client_id' => $settings['google_client_id'],
        'client_secret' => $settings['google_client_secret'],
        'redirect_uri' => getGoogleOAuthRedirectUri(),
        'grant_type' => 'authorization_code',
    ]);

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT => 20,
    ]);

    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($response ?: '{}', true);
    if ($status !== 200 || !$response) {
        $message = $data['error_description'] ?? $data['error'] ?? 'No se pudo completar la autorización con Google';
        throw new Exception($message);
    }

    return $data;
}

function redirectToAdminGoogleSettings($status, $message = '') {
    $params = [
        'tab' => 'google_calendar',
        'google' => $status,
    ];

    if ($message !== '') {
        $params['message'] = $message;
    }

    header('Location: ' . getGoogleAdminSettingsRedirectUri() . '?' . http_build_query($params));
    exit;
}

function getGoogleCalendarAuthUrl($db, $userId, array $input = []) {
    $settings = getGoogleCalendarConfig($db);

    if (!isGoogleOAuthConfigured()) {
        jsonResponse([
            'error' => 'Las credenciales OAuth no están configuradas en el servidor (google.php).',
        ], 400);
    }

    $state = createGoogleOAuthState($userId);

    jsonResponse([
        'url' => buildGoogleOAuthUrl($settings, $state),
        'redirect_uri' => getGoogleOAuthRedirectUri(),
    ]);
}

function fetchGoogleCalendarList($accessToken) {
    $data = googleApiRequest(
        'GET',
        'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer',
        $accessToken
    );

    $calendars = [];
    foreach ($data['items'] ?? [] as $item) {
        $calendars[] = [
            'id' => $item['id'] ?? '',
            'summary' => $item['summary'] ?? $item['id'] ?? '',
            'primary' => !empty($item['primary']),
        ];
    }

    return $calendars;
}

function detectGoogleCalendarId($accessToken) {
    $calendars = fetchGoogleCalendarList($accessToken);

    foreach ($calendars as $calendar) {
        if (!empty($calendar['primary']) && !empty($calendar['id'])) {
            return $calendar;
        }
    }

    if (!empty($calendars[0]['id'])) {
        return $calendars[0];
    }

    return [
        'id' => 'primary',
        'summary' => 'Calendario principal',
        'primary' => true,
    ];
}

function handleGoogleCalendarOAuthCallback() {
    $error = $_GET['error'] ?? '';
    if ($error) {
        $description = $_GET['error_description'] ?? $error;
        redirectToAdminGoogleSettings('error', $description);
    }

    $code = trim($_GET['code'] ?? '');
    $state = trim($_GET['state'] ?? '');

    if (!$code || !$state) {
        redirectToAdminGoogleSettings('error', 'Respuesta incompleta de Google');
    }

    try {
        validateGoogleOAuthState($state);
        $db = getDB();
        $settings = getGoogleCalendarConfig($db);
        $tokens = exchangeGoogleAuthCode($settings, $code);

        if (empty($tokens['refresh_token'])) {
            throw new Exception('Google no devolvió un refresh token. Revoca el acceso previo en tu cuenta Google e intenta conectar de nuevo.');
        }

        if (empty($tokens['access_token'])) {
            throw new Exception('Google no devolvió un token de acceso válido.');
        }

        $calendar = detectGoogleCalendarId($tokens['access_token']);

        updateSiteSettings($db, [
            'google_refresh_token' => $tokens['refresh_token'],
            'google_calendar_enabled' => '1',
            'google_calendar_id' => $calendar['id'],
        ]);

        $calendarLabel = trim($calendar['summary'] ?? '') ?: $calendar['id'];
        redirectToAdminGoogleSettings('connected', 'Calendario conectado: ' . $calendarLabel);
    } catch (Exception $e) {
        redirectToAdminGoogleSettings('error', $e->getMessage());
    }
}

function disconnectGoogleCalendar($db) {
    updateSiteSettings($db, [
        'google_refresh_token' => '',
    ]);

    jsonResponse([
        'ok' => true,
        'message' => 'Google Calendar desconectado',
    ]);
}

function getGoogleCalendarOAuthInfo() {
    return [
        'redirect_uri' => getGoogleOAuthRedirectUri(),
        'scope' => GOOGLE_CALENDAR_SCOPE,
    ];
}

function getGoogleCalendarConfig($db = null) {
    if (!$db) {
        $db = getDB();
    }

    return getGoogleCalendarSettings($db);
}

function isGoogleCalendarConfigured(array $settings = null) {
    if ($settings === null) {
        $settings = getGoogleCalendarConfig();
    }

    return ($settings['google_calendar_enabled'] ?? '0') === '1'
        && !empty($settings['google_client_id'])
        && !empty($settings['google_client_secret'])
        && !empty($settings['google_refresh_token'])
        && !empty($settings['google_calendar_id']);
}

function getGoogleAccessToken(array $settings) {
    $payload = http_build_query([
        'client_id' => $settings['google_client_id'],
        'client_secret' => $settings['google_client_secret'],
        'refresh_token' => $settings['google_refresh_token'],
        'grant_type' => 'refresh_token',
    ]);

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT => 20,
    ]);

    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($status !== 200 || !$response) {
        $error = json_decode($response ?: '{}', true);
        throw new Exception($error['error_description'] ?? $error['error'] ?? 'No se pudo obtener token de Google');
    }

    $data = json_decode($response, true);
    if (empty($data['access_token'])) {
        throw new Exception('Respuesta inválida de Google OAuth');
    }

    return $data['access_token'];
}

function googleApiRequest($method, $url, $accessToken, $body = null) {
    $headers = [
        'Authorization: Bearer ' . $accessToken,
        'Accept: application/json',
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);

    if ($body !== null) {
        $json = json_encode($body);
        $headers[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
    }

    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($response ?: '{}', true);

    if ($status < 200 || $status >= 300) {
        $message = $data['error']['message'] ?? $data['error_description'] ?? 'Error de Google Calendar';
        throw new Exception($message);
    }

    return $data;
}

function buildGoogleCalendarEventPayload(array $appointment) {
    $date = $appointment['appointment_date'];
    $time = $appointment['appointment_time'];
    if (strlen($time) === 5) {
        $time .= ':00';
    }

    $duration = (int) ($appointment['duration_minutes'] ?? 60);
    $start = new DateTime($date . ' ' . $time);
    $end = clone $start;
    $end->modify('+' . $duration . ' minutes');

    $clientName = trim($appointment['client_name'] ?? 'Cliente');
    $serviceName = trim($appointment['service_name'] ?? 'Servicio');
    $phone = trim($appointment['client_phone'] ?? '');
    $email = trim($appointment['client_email'] ?? '');

    $description = "Servicio: {$serviceName}\nCliente: {$clientName}";
    if ($phone) {
        $description .= "\nTeléfono: {$phone}";
    }
    if ($email) {
        $description .= "\nEmail: {$email}";
    }

    return [
        'summary' => "{$serviceName} - {$clientName}",
        'description' => $description,
        'start' => [
            'dateTime' => $start->format('c'),
            'timeZone' => 'America/Mexico_City',
        ],
        'end' => [
            'dateTime' => $end->format('c'),
            'timeZone' => 'America/Mexico_City',
        ],
    ];
}

function syncAppointmentToGoogleCalendar(array $appointment, $db = null) {
    if (!$db) {
        $db = getDB();
    }

    $settings = getGoogleCalendarConfig($db);

    if (($settings['google_sync_on_booking'] ?? '1') !== '1') {
        return ['synced' => false, 'reason' => 'sync_disabled'];
    }

    if (!isGoogleCalendarConfigured($settings)) {
        return ['synced' => false, 'reason' => 'not_configured'];
    }

    try {
        $accessToken = getGoogleAccessToken($settings);
        $calendarId = rawurlencode($settings['google_calendar_id']);
        $payload = buildGoogleCalendarEventPayload($appointment);
        $event = googleApiRequest(
            'POST',
            "https://www.googleapis.com/calendar/v3/calendars/{$calendarId}/events",
            $accessToken,
            $payload
        );

        return [
            'synced' => true,
            'event_id' => $event['id'] ?? null,
            'html_link' => $event['htmlLink'] ?? null,
        ];
    } catch (Exception $e) {
        error_log('[Tapai Google Calendar] Sync failed: ' . $e->getMessage());
        return ['synced' => false, 'reason' => $e->getMessage()];
    }
}

function listGoogleCalendars($db = null) {
    if (!$db) {
        $db = getDB();
    }

    $settings = getGoogleCalendarConfig($db);

    if (empty($settings['google_refresh_token'])) {
        jsonResponse(['error' => 'Conecta Google Calendar antes de listar calendarios'], 400);
    }

    try {
        $accessToken = getGoogleAccessToken($settings);
        $calendars = fetchGoogleCalendarList($accessToken);

        jsonResponse([
            'ok' => true,
            'calendars' => $calendars,
            'selected_calendar_id' => $settings['google_calendar_id'] ?? 'primary',
        ]);
    } catch (Exception $e) {
        jsonResponse(['error' => $e->getMessage()], 400);
    }
}

function testGoogleCalendarConnection($db = null) {
    if (!$db) {
        $db = getDB();
    }

    $settings = getGoogleCalendarConfig($db);

    if (!isGoogleCalendarConfigured($settings)) {
        jsonResponse(['error' => 'Completa Client ID, Client Secret, Refresh Token y Calendar ID'], 400);
    }

    try {
        $accessToken = getGoogleAccessToken($settings);
        $calendarId = rawurlencode($settings['google_calendar_id']);
        $calendar = googleApiRequest(
            'GET',
            "https://www.googleapis.com/calendar/v3/calendars/{$calendarId}",
            $accessToken
        );

        jsonResponse([
            'ok' => true,
            'message' => 'Conexión exitosa con Google Calendar',
            'calendar' => [
                'id' => $calendar['id'] ?? $settings['google_calendar_id'],
                'summary' => $calendar['summary'] ?? '',
            ],
        ]);
    } catch (Exception $e) {
        jsonResponse(['error' => $e->getMessage()], 400);
    }
}
