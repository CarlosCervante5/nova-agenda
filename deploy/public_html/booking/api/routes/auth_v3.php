<?php
require_once __DIR__ . '/../config/schema_roles.php';
require_once __DIR__ . '/../config/user_services.php';

function login($input) {
    $db = getDB();
    ensureRoleSchema($db);
    ensureUserServicesSchema($db);

    $stmt = $db->prepare("SELECT id, username, email, full_name, role, password_hash, active FROM users WHERE username = ?");
    $stmt->execute([$input['username'] ?? '']);
    $user = $stmt->fetch();

    if (!$user || !(int) $user['active'] || !password_verify($input['password'] ?? '', $user['password_hash'])) {
        jsonResponse(['error' => 'Credenciales inválidas'], 401);
    }

    $role = normalizeRole($user['role']);
    $token = JWT::encode([
        'userId' => (int) $user['id'],
        'username' => $user['username'],
        'role' => $role,
    ]);

    jsonResponse([
        'token' => $token,
        'user' => buildAuthUserPayload($db, $user, $role),
    ]);
}

function buildAuthUserPayload($db, array $user, $role) {
    $payload = [
        'id' => (int) $user['id'],
        'username' => $user['username'],
        'email' => $user['email'],
        'full_name' => $user['full_name'],
        'role' => $role,
        'service_ids' => [],
        'services' => [],
    ];

    if ($role === 'profesional') {
        $profile = fetchUserWithServices($db, (int) $user['id']);
        if ($profile) {
            $payload['service_ids'] = $profile['service_ids'] ?? [];
            $payload['services'] = $profile['services'] ?? [];
            $payload['profile_bio'] = $profile['profile_bio'] ?? '';
            $payload['profile_photo_url'] = $profile['profile_photo_url'] ?? '';
            $payload['booking_url'] = $profile['booking_url'] ?? '';
            $payload['booking_slug'] = $profile['booking_slug'] ?? '';
        }
    }

    if ($role === 'cliente') {
        require_once __DIR__ . '/../config/schema_clients.php';
        ensureClientSchema($db);
        $clientId = getClientIdForUser($db, ['userId' => (int) $user['id'], 'role' => 'cliente']);
        if ($clientId) {
            $payload['client_id'] = $clientId;
            $stmt = $db->prepare("SELECT name, email, phone FROM clients WHERE id = ?");
            $stmt->execute([$clientId]);
            $client = $stmt->fetch();
            if ($client) {
                $payload['client_profile'] = [
                    'id' => $clientId,
                    'name' => $client['name'],
                    'email' => $client['email'],
                    'phone' => $client['phone'],
                ];
            }
        }
    }

    return $payload;
}

function getAuthenticatedUser($token) {
    $db = getDB();
    ensureRoleSchema($db);
    ensureUserServicesSchema($db);

    $stmt = $db->prepare("SELECT id, username, email, full_name, role, active FROM users WHERE id = ?");
    $stmt->execute([(int) ($token['userId'] ?? 0)]);
    $user = $stmt->fetch();

    if (!$user || !(int) $user['active']) {
        jsonResponse(['error' => 'Unauthorized'], 401);
    }

    $role = normalizeRole($user['role']);

    return buildAuthUserPayload($db, $user, $role);
}
