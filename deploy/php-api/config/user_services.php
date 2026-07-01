<?php

require_once __DIR__ . '/professional_profile.php';

function ensureUserServicesSchema($db) {
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    $db->exec("
        CREATE TABLE IF NOT EXISTS user_services (
            user_id INT NOT NULL,
            service_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, service_id),
            KEY idx_user_services_service (service_id),
            CONSTRAINT fk_user_services_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_user_services_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $stmt = $db->prepare("SELECT id FROM users WHERE username = ? AND role = 'profesional'");
    $stmt->execute(['profesional']);
    $user = $stmt->fetch();
    if (!$user) {
        return;
    }

    $countStmt = $db->prepare("SELECT COUNT(*) AS total FROM user_services WHERE user_id = ?");
    $countStmt->execute([(int) $user['id']]);
    if ((int) $countStmt->fetch()['total'] > 0) {
        return;
    }

    $services = $db->query("SELECT id FROM services WHERE active = 1")->fetchAll();
    if (!$services) {
        return;
    }

    syncUserServices($db, (int) $user['id'], array_column($services, 'id'));
}

function getUserServiceIds($db, $userId) {
    ensureUserServicesSchema($db);
    $stmt = $db->prepare("SELECT service_id FROM user_services WHERE user_id = ? ORDER BY service_id");
    $stmt->execute([(int) $userId]);
    return array_map('intval', array_column($stmt->fetchAll(), 'service_id'));
}

function syncUserServices($db, $userId, array $serviceIds) {
    ensureUserServicesSchema($db);
    $serviceIds = array_values(array_unique(array_filter(array_map('intval', $serviceIds))));

    $db->prepare("DELETE FROM user_services WHERE user_id = ?")->execute([(int) $userId]);

    if (!$serviceIds) {
        return;
    }

    $stmt = $db->prepare("INSERT INTO user_services (user_id, service_id) VALUES (?, ?)");
    foreach ($serviceIds as $serviceId) {
        $stmt->execute([(int) $userId, $serviceId]);
    }
}

function userCanAccessService($db, $user, $serviceId) {
    if (isAdmin($user)) {
        return true;
    }

    $userId = (int) ($user['userId'] ?? $user['id'] ?? 0);
    if (!$userId || !$serviceId) {
        return false;
    }

    $serviceIds = getUserServiceIds($db, $userId);
    return in_array((int) $serviceId, $serviceIds, true);
}

function appendProfessionalServiceFilter(array $where, array $params, $db, $user, $column = 'a.service_id') {
    if (isAdmin($user)) {
        return [$where, $params];
    }

    $userId = (int) ($user['userId'] ?? 0);
    $serviceIds = getUserServiceIds($db, $userId);

    if (!$serviceIds) {
        $where[] = '1 = 0';
        return [$where, $params];
    }

    $placeholders = implode(',', array_fill(0, count($serviceIds), '?'));
    $where[] = "{$column} IN ({$placeholders})";
    return [$where, array_merge($params, $serviceIds)];
}

function professionalCanAccessClient($db, $user, $clientId) {
    if (isAdmin($user)) {
        return true;
    }

    $clientId = (int) $clientId;
    if (!$clientId) {
        return false;
    }

    $userId = (int) ($user['userId'] ?? 0);
    $serviceIds = getUserServiceIds($db, $userId);
    if (!$serviceIds) {
        return false;
    }

    $placeholders = implode(',', array_fill(0, count($serviceIds), '?'));
    $stmt = $db->prepare("SELECT COUNT(*) FROM appointments WHERE client_id = ? AND service_id IN ($placeholders)");
    $stmt->execute(array_merge([$clientId], $serviceIds));

    return (int) $stmt->fetchColumn() > 0;
}

function professionalCanBookClient($db, $user, $clientId) {
    if (isAdmin($user)) {
        return true;
    }

    if (professionalCanAccessClient($db, $user, $clientId)) {
        return true;
    }

    $stmt = $db->prepare("SELECT COUNT(*) FROM appointments WHERE client_id = ?");
    $stmt->execute([(int) $clientId]);

    return (int) $stmt->fetchColumn() === 0;
}

function userCanAccessAppointment($db, $user, $appointmentId) {
    if (isAdmin($user)) {
        return true;
    }

    $stmt = $db->prepare("SELECT service_id FROM appointments WHERE id = ?");
    $stmt->execute([(int) $appointmentId]);
    $row = $stmt->fetch();

    return $row && userCanAccessService($db, $user, $row['service_id']);
}

function fetchUserWithServices($db, $userId) {
    ensureProfessionalProfileSchema($db);

    $stmt = $db->prepare("
        SELECT id, username, email, full_name, role, active, created_at,
               profile_photo, profile_bio, booking_slug
        FROM users
        WHERE id = ?
    ");
    $stmt->execute([(int) $userId]);
    $user = $stmt->fetch();
    if (!$user || normalizeRole($user['role']) !== 'profesional') {
        return null;
    }

    $user['id'] = (int) $user['id'];
    $user['active'] = (int) $user['active'];
    $user['role'] = normalizeRole($user['role']);
    $user['service_ids'] = getUserServiceIds($db, $user['id']);

    $stmt = $db->prepare("
        SELECT s.id, s.name, COALESCE(c.color, s.color, '#7d7f3e') AS color, c.name AS category_name
        FROM user_services us
        JOIN services s ON s.id = us.service_id
        LEFT JOIN service_categories c ON c.id = s.category_id
        WHERE us.user_id = ?
        ORDER BY c.sort_order, s.name
    ");
    $stmt->execute([(int) $userId]);
    $user['services'] = $stmt->fetchAll();

    return appendProfessionalProfileFields($user);
}
