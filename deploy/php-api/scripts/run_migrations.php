<?php

require_once __DIR__ . '/../config/database_v3.php';
require_once __DIR__ . '/../config/site_settings.php';
require_once __DIR__ . '/../config/schema_roles.php';
require_once __DIR__ . '/../config/schema_categories.php';
require_once __DIR__ . '/../config/user_services.php';
require_once __DIR__ . '/../config/schema_clients.php';
require_once __DIR__ . '/../config/schema_client_files.php';
require_once __DIR__ . '/../config/schema_appointments.php';

header('Content-Type: application/json; charset=utf-8');

$key = $_GET['key'] ?? '';
if ($key !== 'tapai_migrate_20250620') {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

try {
    $db = getDB();
    ensureSiteSettingsSchema($db);
    ensureRoleSchema($db);
    ensureCategorySchema($db);
    ensureUserServicesSchema($db);
    ensureClientSchema($db);
    ensureClientFilesSchema($db);
    ensureClientProfileLogSchema($db);
    ensureAppointmentSchema($db);
    $profilesCreated = provisionAllClientProfiles($db);

    $checks = [
        'site_settings' => (int) $db->query("SELECT COUNT(*) FROM site_settings")->fetchColumn(),
        'mail_notify_status_confirmed' => getSiteSettings($db, ['mail_notify_status_confirmed'])['mail_notify_status_confirmed'] ?? null,
        'mail_tpl_confirmation_heading' => getSiteSettings($db, ['mail_tpl_confirmation_heading'])['mail_tpl_confirmation_heading'] ?? null,
        'user_services' => (int) $db->query("SELECT COUNT(*) FROM user_services")->fetchColumn(),
        'service_categories' => (int) $db->query("SELECT COUNT(*) FROM service_categories")->fetchColumn(),
        'clients_with_user_id' => (int) $db->query("SELECT COUNT(*) FROM clients WHERE user_id IS NOT NULL")->fetchColumn(),
        'client_files' => (int) $db->query("SELECT COUNT(*) FROM client_files")->fetchColumn(),
        'client_profile_logs' => (int) $db->query("SELECT COUNT(*) FROM client_profile_logs")->fetchColumn(),
        'client_profiles_created' => $profilesCreated,
    ];

    echo json_encode([
        'ok' => true,
        'message' => 'Migraciones ejecutadas correctamente',
        'checks' => $checks,
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
