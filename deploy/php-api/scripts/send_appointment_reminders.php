<?php

require_once __DIR__ . '/../utils/Mailer.php';

function runAppointmentReminders($db, $key = '') {
    header('Content-Type: application/json; charset=utf-8');

    $expectedKey = getenv('TAPAI_CRON_KEY') ?: 'tapai_reminders_20250622';
    if ($key !== $expectedKey) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }

    try {
        $summary = processAppointmentReminders($db);
        echo json_encode([
            'ok' => true,
            'message' => 'Recordatorios procesados',
            'summary' => $summary,
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode([
            'ok' => false,
            'error' => $e->getMessage(),
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }
}

if (PHP_SAPI === 'cli') {
    require_once __DIR__ . '/../config/database_v3.php';
    $db = getDB();
    $key = $argv[1] ?? getenv('TAPAI_CRON_KEY') ?: 'tapai_reminders_20250622';
    $_GET['key'] = $key;
    runAppointmentReminders($db, $key);
}
