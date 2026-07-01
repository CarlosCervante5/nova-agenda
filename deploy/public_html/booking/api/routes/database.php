<?php
// Database configuration
define('DB_HOST', 'localhost');
define('DB_NAME', 'tapaicentro_calendar');
define('DB_USER', 'tapaicentro_calendar');
define('DB_PASS', 'Hola2026@@');
define('DB_CHARSET', 'utf8mb4');

// JWT Secret
define('JWT_SECRET', 'serene_balance_booking_secret_2025_deploy');

// Get database connection
function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]);
        } catch (PDOException $e) {
            die(json_encode(['error' => 'Database connection failed']));
        }
    }
    return $pdo;
}
