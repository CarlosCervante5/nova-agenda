<?php
error_reporting(E_ERROR | E_PARSE);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Cache-Control: no-cache, no-store, must-revalidate');

if (function_exists('opcache_reset')) { @opcache_reset(); }

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/config/app_paths.php';

$requestUri = $_SERVER['REQUEST_URI'];
$basePath = getApiBasePath();
$path = parse_url($requestUri, PHP_URL_PATH);
if (str_starts_with($path, $basePath)) {
    $path = substr($path, strlen($basePath));
}
$path = '/' . trim($path, '/');

if ($path === '/settings/google-calendar/callback' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    require_once __DIR__ . '/config/database_v3.php';
    require_once __DIR__ . '/middleware/auth_v3.php';
    require_once __DIR__ . '/utils/GoogleCalendar.php';
    handleGoogleCalendarOAuthCallback();
    exit;
}

if ($path === '/cron/appointment-reminders' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    require_once __DIR__ . '/config/database_v3.php';
    require_once __DIR__ . '/scripts/send_appointment_reminders.php';
    runAppointmentReminders(getDB(), $_GET['key'] ?? '');
    exit;
}

require_once __DIR__ . '/config/database_v3.php';
require_once __DIR__ . '/middleware/auth_v3.php';

$method = $_SERVER['REQUEST_METHOD'];

// Get JSON input for POST/PUT
$input = json_decode(file_get_contents('php://input'), true) ?: [];

// Route handling
try {
    // Auth routes
    if ($path === '/auth/login' && $method === 'POST') {
        require __DIR__ . '/routes/auth_v3.php';
        login($input);
    }
    elseif ($path === '/auth/me' && $method === 'GET') {
        require __DIR__ . '/routes/auth_v3.php';
        $token = authenticate();
        jsonResponse(getAuthenticatedUser($token));
    }
    // Public routes (no auth required)
    elseif (strpos($path, '/public/') === 0) {
        require __DIR__ . '/routes/public_v3.php';
        handlePublic($path, $method, $input);
    }
    // Protected routes (auth required)
    elseif (strpos($path, '/appointments') === 0) {
        $user = authenticate();
        require __DIR__ . '/routes/appointments_v3.php';
        handleAppointments($path, $method, $input, $user);
    }
    elseif (strpos($path, '/client/') === 0) {
        $user = authenticate();
        require __DIR__ . '/routes/client_profile_v3.php';
        handleClientProfile($path, $method, $input, $user);
    }
    elseif (strpos($path, '/professional/') === 0) {
        $user = authenticate();
        require __DIR__ . '/routes/professional_profile_v3.php';
        handleProfessionalProfile($path, $method, $input, $user);
    }
    elseif (strpos($path, '/clients') === 0) {
        $user = authenticate();
        require __DIR__ . '/routes/clients_v3.php';
        handleClients($path, $method, $input, $user);
    }
    elseif (strpos($path, '/users') === 0) {
        $user = authenticate();
        requireAdmin($user);
        require __DIR__ . '/routes/users_v3.php';
        handleUsers($path, $method, $input);
    }
    elseif (strpos($path, '/categories') === 0) {
        $user = authenticate();
        requireAdmin($user);
        require __DIR__ . '/routes/categories_v3.php';
        handleCategories($path, $method, $input);
    }
    elseif (strpos($path, '/services') === 0) {
        $user = authenticate();
        if ($method !== 'GET') {
            requireAdmin($user);
        }
        require __DIR__ . '/routes/services_v3.php';
        handleServices($path, $method, $input, $user);
    }
    elseif (strpos($path, '/form-questions') === 0) {
        $user = authenticate();
        requireAdmin($user);
        require __DIR__ . '/routes/formQuestions_v3.php';
        handleFormQuestions($path, $method, $input);
    }
    elseif (strpos($path, '/settings') === 0) {
        $user = authenticate();
        requireAdmin($user);
        require __DIR__ . '/routes/settings_v3.php';
        handleSettings($path, $method, $input, $user);
    }
    elseif ($path === '/wordpress-plugin/download' && $method === 'GET') {
        $user = authenticate();
        requireAdmin($user);
        require __DIR__ . '/routes/wordpress_plugin_v3.php';
        downloadWordPressPlugin();
    }
    else {
        jsonResponse(['error' => 'Not found'], 404);
    }
} catch (Exception $e) {
    jsonResponse(['error' => 'Server error: ' . $e->getMessage()], 500);
}
