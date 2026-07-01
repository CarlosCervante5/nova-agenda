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

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/middleware/auth.php';

$requestUri = $_SERVER['REQUEST_URI'];
$basePath = '/booking/api';

// Remove query string and base path
$path = parse_url($requestUri, PHP_URL_PATH);
$path = str_replace($basePath, '', $path);
$path = '/' . trim($path, '/');

$method = $_SERVER['REQUEST_METHOD'];

// Get JSON input for POST/PUT
$input = json_decode(file_get_contents('php://input'), true) ?: [];

// Route handling
try {
    // Auth routes
    if ($path === '/auth/login' && $method === 'POST') {
        require __DIR__ . '/routes/auth.php';
        login($input);
    }
    elseif ($path === '/auth/me' && $method === 'GET') {
        $user = authenticate();
        jsonResponse(['id' => $user['userId'], 'username' => $user['username']]);
    }
    // Public routes (no auth required)
    elseif (strpos($path, '/public/') === 0) {
        require __DIR__ . '/routes/public_v3.php';
        handlePublic($path, $method, $input);
    }
    // Protected routes (auth required)
    elseif (strpos($path, '/appointments') === 0) {
        $user = authenticate();
        require __DIR__ . '/routes/appointments.php';
        handleAppointments($path, $method, $input);
    }
    elseif (strpos($path, '/clients') === 0) {
        $user = authenticate();
        require __DIR__ . '/routes/clients.php';
        handleClients($path, $method, $input);
    }
    elseif (strpos($path, '/services') === 0) {
        $user = authenticate();
        require __DIR__ . '/routes/services.php';
        handleServices($path, $method, $input);
    }
    elseif (strpos($path, '/form-questions') === 0) {
        $user = authenticate();
        require __DIR__ . '/routes/formQuestions.php';
        handleFormQuestions($path, $method, $input);
    }
    else {
        jsonResponse(['error' => 'Not found'], 404);
    }
} catch (Exception $e) {
    jsonResponse(['error' => 'Server error: ' . $e->getMessage()], 500);
}
