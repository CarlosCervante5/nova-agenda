<?php
require_once __DIR__ . '/../config/schema_roles.php';
require_once __DIR__ . '/../config/user_services.php';
require_once __DIR__ . '/../config/user_accounts.php';
require_once __DIR__ . '/../config/professional_profile.php';

function handleUsers($path, $method, $input) {
    $db = getDB();
    ensureRoleSchema($db);
    ensureUserServicesSchema($db);
    ensureProfessionalProfileSchema($db);

    if ($path === '/users/admins' && $method === 'GET') {
        $stmt = $db->query("
            SELECT id, username, email, full_name, active, created_at
            FROM users
            WHERE role = 'admin'
            ORDER BY full_name, username
        ");
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['active'] = (int) $row['active'];
        }
        jsonResponse($rows);
    }

    if (preg_match('#^/users/admins/(\d+)$#', $path, $matches) && $method === 'GET') {
        $user = fetchAdminUser($db, $matches[1]);
        if (!$user) {
            jsonResponse(['error' => 'Administrador no encontrado'], 404);
        }
        jsonResponse($user);
    }

    if ($path === '/users/admins' && $method === 'POST') {
        $userId = createUserAccount($db, $input, 'admin');
        jsonResponse([
            'id' => $userId,
            'message' => 'Administrador creado',
            'user' => fetchAdminUser($db, $userId),
        ], 201);
    }

    if (preg_match('#^/users/admins/(\d+)$#', $path, $matches) && $method === 'PUT') {
        $userId = (int) $matches[1];
        $existing = fetchAdminUser($db, $userId);
        if (!$existing) {
            jsonResponse(['error' => 'Administrador no encontrado'], 404);
        }

        updateUserAccount($db, $userId, $input, $existing, ['admin']);
        jsonResponse([
            'message' => 'Administrador actualizado',
            'user' => fetchAdminUser($db, $userId),
        ]);
    }

    if (preg_match('#^/users/admins/(\d+)$#', $path, $matches) && $method === 'DELETE') {
        $userId = (int) $matches[1];
        $existing = fetchAdminUser($db, $userId);
        if (!$existing) {
            jsonResponse(['error' => 'Administrador no encontrado'], 404);
        }

        if ($existing['username'] === 'admin') {
            jsonResponse(['error' => 'No se puede desactivar el administrador principal'], 400);
        }

        $db->prepare("UPDATE users SET active = 0 WHERE id = ?")->execute([$userId]);
        jsonResponse(['message' => 'Administrador desactivado']);
    }

    if ($path === '/users/professionals' && $method === 'GET') {
        $stmt = $db->query("
            SELECT u.id, u.username, u.email, u.full_name, u.active, u.created_at,
                   u.profile_photo, u.profile_bio, u.booking_slug,
                   COUNT(us.service_id) AS services_count
            FROM users u
            LEFT JOIN user_services us ON us.user_id = u.id
            WHERE u.role = 'profesional'
            GROUP BY u.id
            ORDER BY u.full_name, u.username
        ");
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['active'] = (int) $row['active'];
            $row['services_count'] = (int) $row['services_count'];
            $row['service_ids'] = getUserServiceIds($db, $row['id']);
            $row = appendProfessionalProfileFields($row);
        }
        jsonResponse($rows);
    }

    if (preg_match('#^/users/professionals/(\d+)$#', $path, $matches) && $method === 'GET') {
        $user = fetchUserWithServices($db, $matches[1]);
        if (!$user) {
            jsonResponse(['error' => 'Profesional no encontrado'], 404);
        }
        jsonResponse($user);
    }

    if ($path === '/users/professionals' && $method === 'POST') {
        $serviceIds = $input['service_ids'] ?? [];
        if (!is_array($serviceIds) || count($serviceIds) === 0) {
            jsonResponse(['error' => 'Debes asignar al menos un servicio'], 400);
        }

        $validServices = validateServiceIds($db, $serviceIds);
        if (!$validServices) {
            jsonResponse(['error' => 'Uno o más servicios no son válidos'], 400);
        }

        $userId = createUserAccount($db, $input, 'profesional');
        syncUserServices($db, $userId, $validServices);

        if (array_key_exists('profile_bio', $input) || array_key_exists('booking_slug', $input)) {
            $createdUser = fetchUserWithServices($db, $userId);
            updateUserAccount($db, $userId, $input, $createdUser, ['profesional']);
        }

        jsonResponse([
            'id' => $userId,
            'message' => 'Profesional creado',
            'user' => fetchUserWithServices($db, $userId),
        ], 201);
    }

    if (preg_match('#^/users/professionals/(\d+)$#', $path, $matches) && $method === 'PUT') {
        $userId = (int) $matches[1];
        $existing = fetchUserWithServices($db, $userId);
        if (!$existing) {
            jsonResponse(['error' => 'Profesional no encontrado'], 404);
        }

        $serviceIds = $input['service_ids'] ?? $existing['service_ids'];
        if (!is_array($serviceIds) || count($serviceIds) === 0) {
            jsonResponse(['error' => 'Debes asignar al menos un servicio'], 400);
        }

        $validServices = validateServiceIds($db, $serviceIds);
        if (!$validServices) {
            jsonResponse(['error' => 'Uno o más servicios no son válidos'], 400);
        }

        updateUserAccount($db, $userId, $input, $existing, ['profesional']);
        syncUserServices($db, $userId, $validServices);

        jsonResponse([
            'message' => 'Profesional actualizado',
            'user' => fetchUserWithServices($db, $userId),
        ]);
    }

    if (preg_match('#^/users/professionals/(\d+)/photo$#', $path, $matches) && $method === 'POST') {
        handleProfessionalPhotoUpload($db, (int) $matches[1]);
    }

    if (preg_match('#^/users/professionals/(\d+)/photo$#', $path, $matches) && $method === 'DELETE') {
        deleteProfessionalPhoto($db, (int) $matches[1]);
    }

    if (preg_match('#^/users/professionals/(\d+)$#', $path, $matches) && $method === 'DELETE') {
        deleteProfessionalAccount($db, (int) $matches[1]);
    }

    jsonResponse(['error' => 'Not found'], 404);
}

function validateServiceIds($db, array $serviceIds) {
    $serviceIds = array_values(array_unique(array_filter(array_map('intval', $serviceIds))));
    if (!$serviceIds) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($serviceIds), '?'));
    $stmt = $db->prepare("SELECT id FROM services WHERE id IN ($placeholders) AND active = 1");
    $stmt->execute($serviceIds);
    $valid = array_map('intval', array_column($stmt->fetchAll(), 'id'));

    return count($valid) === count($serviceIds) ? $valid : null;
}
