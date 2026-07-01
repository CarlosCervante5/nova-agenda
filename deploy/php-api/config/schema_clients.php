<?php

require_once __DIR__ . '/schema_roles.php';
require_once __DIR__ . '/schema_appointments.php';

function ensureClientSchema($db) {
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    $col = $db->query("SHOW COLUMNS FROM clients LIKE 'user_id'")->fetch();
    if (!$col) {
        $db->exec("ALTER TABLE clients ADD COLUMN user_id INT NULL AFTER notes");
    }

    $col = $db->query("SHOW COLUMNS FROM clients LIKE 'email_normalized'")->fetch();
    if (!$col) {
        $db->exec("ALTER TABLE clients ADD COLUMN email_normalized VARCHAR(100) NULL AFTER email");
    }

    $col = $db->query("SHOW COLUMNS FROM clients LIKE 'phone_normalized'")->fetch();
    if (!$col) {
        $db->exec("ALTER TABLE clients ADD COLUMN phone_normalized VARCHAR(20) NULL AFTER phone");
    }

    backfillClientNormalizedFields($db);
    dedupeClientsByNormalizedKeys($db);

    $indexes = $db->query("SHOW INDEX FROM clients WHERE Key_name = 'idx_clients_email_normalized'")->fetch();
    if (!$indexes) {
        $db->exec("CREATE UNIQUE INDEX idx_clients_email_normalized ON clients (email_normalized)");
    }

    $indexes = $db->query("SHOW INDEX FROM clients WHERE Key_name = 'idx_clients_phone_normalized'")->fetch();
    if (!$indexes) {
        $db->exec("CREATE UNIQUE INDEX idx_clients_phone_normalized ON clients (phone_normalized)");
    }

    $indexes = $db->query("SHOW INDEX FROM clients WHERE Key_name = 'idx_clients_user_id'")->fetch();
    if (!$indexes) {
        $db->exec("CREATE UNIQUE INDEX idx_clients_user_id ON clients (user_id)");
    }
}

function backfillClientNormalizedFields($db) {
    $stmt = $db->query("SELECT id, email, phone FROM clients");
    $rows = $stmt->fetchAll();
    if (!$rows) {
        return;
    }

    $update = $db->prepare("UPDATE clients SET email_normalized = ?, phone_normalized = ? WHERE id = ?");
    foreach ($rows as $row) {
        $update->execute([
            normalizeClientEmail($row['email'] ?? ''),
            normalizeClientPhone($row['phone'] ?? ''),
            (int) $row['id'],
        ]);
    }
}

function dedupeClientsByNormalizedKeys($db) {
    foreach (['email_normalized', 'phone_normalized'] as $field) {
        $stmt = $db->query("
            SELECT {$field} AS key_value, GROUP_CONCAT(id ORDER BY id) AS ids, COUNT(*) AS total
            FROM clients
            WHERE {$field} IS NOT NULL AND {$field} != ''
            GROUP BY {$field}
            HAVING total > 1
        ");
        $groups = $stmt->fetchAll();
        foreach ($groups as $group) {
            $ids = array_map('intval', explode(',', $group['ids']));
            $keepId = array_shift($ids);
            foreach ($ids as $duplicateId) {
                $db->prepare("UPDATE appointments SET client_id = ? WHERE client_id = ?")->execute([$keepId, $duplicateId]);
                $db->prepare("DELETE FROM clients WHERE id = ?")->execute([$duplicateId]);
            }
        }
    }
}

function normalizeClientEmail($email) {
    $email = strtolower(trim((string) $email));
    return $email !== '' ? $email : null;
}

function normalizeClientPhone($phone) {
    $digits = preg_replace('/\D+/', '', (string) $phone);
    return $digits !== '' ? $digits : null;
}

function findClientByUniqueKeys($db, $email, $phone, $excludeId = null) {
    $emailNorm = normalizeClientEmail($email);
    $phoneNorm = normalizeClientPhone($phone);

    if ($emailNorm) {
        $sql = "SELECT * FROM clients WHERE email_normalized = ?";
        $params = [$emailNorm];
        if ($excludeId) {
            $sql .= " AND id != ?";
            $params[] = (int) $excludeId;
        }
        $sql .= " LIMIT 1";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        if ($row) {
            return $row;
        }
    }

    if ($phoneNorm) {
        $sql = "SELECT * FROM clients WHERE phone_normalized = ?";
        $params = [$phoneNorm];
        if ($excludeId) {
            $sql .= " AND id != ?";
            $params[] = (int) $excludeId;
        }
        $sql .= " LIMIT 1";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        if ($row) {
            return $row;
        }
    }

    return null;
}

function validateClientUnique($db, $email, $phone, $excludeId = null) {
    $duplicate = findClientByUniqueKeys($db, $email, $phone, $excludeId);
    if (!$duplicate) {
        return null;
    }

    $emailNorm = normalizeClientEmail($email);
    $phoneNorm = normalizeClientPhone($phone);
    $reasons = [];

    if ($emailNorm && ($duplicate['email_normalized'] ?? '') === $emailNorm) {
        $reasons[] = 'correo';
    }
    if ($phoneNorm && ($duplicate['phone_normalized'] ?? '') === $phoneNorm) {
        $reasons[] = 'teléfono';
    }

    return [
        'client' => sanitizeClientRow($duplicate),
        'reasons' => $reasons,
        'message' => 'Ya existe un cliente con el mismo ' . implode(' y ', $reasons) . '.',
    ];
}

function sanitizeClientRow(array $client) {
    return [
        'id' => (int) $client['id'],
        'name' => $client['name'] ?? '',
        'email' => $client['email'] ?? '',
        'phone' => $client['phone'] ?? '',
        'notes' => $client['notes'] ?? '',
        'user_id' => isset($client['user_id']) ? (int) $client['user_id'] : null,
        'has_profile' => !empty($client['user_id']),
        'created_at' => $client['created_at'] ?? null,
    ];
}

function hydrateClientRow($db, array $client) {
    $row = sanitizeClientRow($client);
    if ($row['user_id']) {
        $stmt = $db->prepare("SELECT username, email, active FROM users WHERE id = ? AND role = 'cliente' LIMIT 1");
        $stmt->execute([$row['user_id']]);
        $user = $stmt->fetch();
        if ($user) {
            $row['profile_username'] = $user['username'];
            $row['profile_active'] = (int) $user['active'] === 1;
        }
    }
    return $row;
}

function findOrCreateClient($db, array $input) {
    $name = trim($input['name'] ?? '');
    $email = trim($input['email'] ?? '');
    $phone = trim($input['phone'] ?? '');
    $notes = trim($input['notes'] ?? '');

    if ($name === '') {
        jsonResponse(['error' => 'El nombre es obligatorio'], 400);
    }

    $emailNorm = normalizeClientEmail($email);
    if (!$emailNorm) {
        jsonResponse(['error' => 'Indica un correo válido para enviarte la confirmación'], 400);
    }

    $existing = findClientByUniqueKeys($db, $email, $phone);
    if ($existing) {
        $updates = [];
        $values = [];

        if ($name !== '' && trim($existing['name'] ?? '') === '') {
            $updates[] = 'name = ?';
            $values[] = $name;
        }
        if ($email !== '' && trim($existing['email'] ?? '') !== $email) {
            $duplicateEmail = findClientByUniqueKeys($db, $email, '', (int) $existing['id']);
            if (!$duplicateEmail) {
                $updates[] = 'email = ?';
                $updates[] = 'email_normalized = ?';
                $values[] = $email;
                $values[] = normalizeClientEmail($email);
            }
        }
        if ($phone !== '' && trim($existing['phone'] ?? '') === '') {
            $updates[] = 'phone = ?';
            $updates[] = 'phone_normalized = ?';
            $values[] = $phone;
            $values[] = normalizeClientPhone($phone);
        }

        if ($updates) {
            $values[] = (int) $existing['id'];
            $db->prepare("UPDATE clients SET " . implode(', ', $updates) . " WHERE id = ?")->execute($values);
            $stmt = $db->prepare("SELECT * FROM clients WHERE id = ?");
            $stmt->execute([(int) $existing['id']]);
            $existing = $stmt->fetch();
        }

        return [
            'client' => $existing,
            'created' => false,
        ];
    }

    $stmt = $db->prepare("INSERT INTO clients (name, email, phone, notes, email_normalized, phone_normalized) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $name,
        $email,
        $phone,
        $notes,
        normalizeClientEmail($email),
        normalizeClientPhone($phone),
    ]);

    $clientId = (int) $db->lastInsertId();
    $stmt = $db->prepare("SELECT * FROM clients WHERE id = ?");
    $stmt->execute([$clientId]);

    return [
        'client' => $stmt->fetch(),
        'created' => true,
    ];
}

function saveClientRecord($db, array $input, $clientId = null, $authUser = null) {
    $name = trim($input['name'] ?? '');
    $email = trim($input['email'] ?? '');
    $phone = trim($input['phone'] ?? '');
    $notes = $input['notes'] ?? '';

    if ($name === '') {
        jsonResponse(['error' => 'El nombre es obligatorio'], 400);
    }

    if (!normalizeClientEmail($email) && !normalizeClientPhone($phone)) {
        jsonResponse(['error' => 'Indica al menos un correo o teléfono para identificar al cliente de forma única'], 400);
    }

    $duplicate = validateClientUnique($db, $email, $phone, $clientId);
    if ($duplicate) {
        jsonResponse([
            'error' => $duplicate['message'],
            'duplicate' => $duplicate['client'],
        ], 409);
    }

    if ($clientId) {
        $existingStmt = $db->prepare("SELECT * FROM clients WHERE id = ?");
        $existingStmt->execute([(int) $clientId]);
        $existing = $existingStmt->fetch();
        if (!$existing) {
            jsonResponse(['error' => 'Cliente no encontrado'], 404);
        }

        $stmt = $db->prepare("UPDATE clients SET name = ?, email = ?, phone = ?, notes = ?, email_normalized = ?, phone_normalized = ? WHERE id = ?");
        $stmt->execute([
            $name,
            $email,
            $phone,
            $notes,
            normalizeClientEmail($email),
            normalizeClientPhone($phone),
            (int) $clientId,
        ]);

        if ($authUser) {
            logClientProfileChanges($db, (int) $clientId, $existing, [
                'name' => $name,
                'email' => $email,
                'phone' => $phone,
                'notes' => $notes,
            ], $authUser);
        }

        $stmt = $db->prepare("SELECT * FROM clients WHERE id = ?");
        $stmt->execute([(int) $clientId]);
        return $stmt->fetch();
    }

    $stmt = $db->prepare("INSERT INTO clients (name, email, phone, notes, email_normalized, phone_normalized) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $name,
        $email,
        $phone,
        $notes,
        normalizeClientEmail($email),
        normalizeClientPhone($phone),
    ]);

    $newId = (int) $db->lastInsertId();
    $stmt = $db->prepare("SELECT * FROM clients WHERE id = ?");
    $stmt->execute([$newId]);
    $row = $stmt->fetch();
    ensureClientProfileAccount($db, $newId);
    $stmt = $db->prepare("SELECT * FROM clients WHERE id = ?");
    $stmt->execute([$newId]);
    return $stmt->fetch();
}

function getClientIdForUser($db, $authUser) {
    if (getUserRole($authUser) !== 'cliente') {
        return null;
    }

    $stmt = $db->prepare("SELECT id FROM clients WHERE user_id = ? LIMIT 1");
    $stmt->execute([(int) ($authUser['userId'] ?? 0)]);
    $clientId = (int) $stmt->fetchColumn();

    return $clientId ?: null;
}

function buildUniqueClientUsername($db, array $client, $clientId, $preferred = '') {
    $base = trim((string) $preferred);
    if ($base === '') {
        $emailNorm = normalizeClientEmail($client['email'] ?? '');
        if ($emailNorm) {
            $base = strstr($emailNorm, '@', true) ?: ('cliente' . $clientId);
        } else {
            $base = 'cliente' . $clientId;
        }
    }

    $base = strtolower(preg_replace('/[^a-z0-9._-]+/', '', $base));
    if ($base === '') {
        $base = 'cliente' . $clientId;
    }

    $username = $base;
    $suffix = 1;
    while (true) {
        $check = $db->prepare("SELECT id FROM users WHERE username = ? LIMIT 1");
        $check->execute([$username]);
        if (!$check->fetch()) {
            break;
        }
        $username = $base . $suffix;
        $suffix++;
    }

    return substr($username, 0, 80);
}

function defaultClientPassword($clientId) {
    return 'cliente' . str_pad((string) $clientId, 4, '0', STR_PAD_LEFT);
}

function resolveClientUserEmail($db, array $client, $username) {
    $email = trim($client['email'] ?? '');
    if ($email === '') {
        $email = $username . '@clientes.tapai.local';
    }

    $emailCheck = $db->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
    $emailCheck->execute([$email]);
    if ($emailCheck->fetch()) {
        $email = $username . '@clientes.tapai.local';
    }

    return $email;
}

function ensureClientProfileAccount($db, $clientId, array $input = []) {
    ensureRoleSchema($db);

    $stmt = $db->prepare("SELECT * FROM clients WHERE id = ?");
    $stmt->execute([(int) $clientId]);
    $client = $stmt->fetch();

    if (!$client) {
        return null;
    }

    if (!empty($client['user_id'])) {
        $userStmt = $db->prepare("SELECT id, username FROM users WHERE id = ? AND role = 'cliente' LIMIT 1");
        $userStmt->execute([(int) $client['user_id']]);
        $user = $userStmt->fetch();
        if ($user) {
            return [
                'user_id' => (int) $user['id'],
                'username' => $user['username'],
                'client_id' => (int) $clientId,
                'created' => false,
            ];
        }
    }

    $username = buildUniqueClientUsername($db, $client, (int) $clientId, $input['username'] ?? '');
    $password = trim($input['password'] ?? '');
    if (strlen($password) < 6) {
        $password = defaultClientPassword((int) $clientId);
    }

    $email = resolveClientUserEmail($db, $client, $username);
    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    $insert = $db->prepare("INSERT INTO users (username, email, password_hash, full_name, role, active) VALUES (?, ?, ?, ?, 'cliente', 1)");
    $insert->execute([
        $username,
        $email,
        $hash,
        $client['name'],
    ]);

    $userId = (int) $db->lastInsertId();
    $db->prepare("UPDATE clients SET user_id = ? WHERE id = ?")->execute([$userId, (int) $clientId]);

    return [
        'user_id' => $userId,
        'username' => $username,
        'client_id' => (int) $clientId,
        'created' => true,
        'password' => $password,
    ];
}

function updateClientAccess($db, $clientId, array $input) {
    $profile = ensureClientProfileAccount($db, (int) $clientId);
    if (!$profile) {
        jsonResponse(['error' => 'Cliente no encontrado'], 404);
    }

    $stmt = $db->prepare("SELECT c.*, u.id AS linked_user_id, u.username
        FROM clients c
        LEFT JOIN users u ON u.id = c.user_id AND u.role = 'cliente'
        WHERE c.id = ?");
    $stmt->execute([(int) $clientId]);
    $client = $stmt->fetch();

    if (empty($client['linked_user_id'])) {
        jsonResponse(['error' => 'No se pudo vincular el acceso del cliente'], 500);
    }

    $userId = (int) $client['linked_user_id'];

    if (array_key_exists('username', $input)) {
        $username = trim((string) $input['username']);
        if ($username === '') {
            jsonResponse(['error' => 'El usuario no puede estar vacío'], 400);
        }

        $check = $db->prepare("SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1");
        $check->execute([$username, $userId]);
        if ($check->fetch()) {
            jsonResponse(['error' => 'Ese nombre de usuario ya está en uso'], 409);
        }

        $db->prepare("UPDATE users SET username = ? WHERE id = ?")->execute([$username, $userId]);
    }

    if (!empty($input['password'])) {
        if (strlen($input['password']) < 6) {
            jsonResponse(['error' => 'La contraseña debe tener al menos 6 caracteres'], 400);
        }

        $hash = password_hash($input['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        $db->prepare("UPDATE users SET password_hash = ? WHERE id = ?")->execute([$hash, $userId]);
    }

    $db->prepare("UPDATE users SET full_name = ? WHERE id = ?")->execute([$client['name'], $userId]);

    $userStmt = $db->prepare("SELECT username FROM users WHERE id = ?");
    $userStmt->execute([$userId]);

    return [
        'user_id' => $userId,
        'username' => $userStmt->fetchColumn(),
        'client_id' => (int) $clientId,
    ];
}

function provisionAllClientProfiles($db) {
    ensureRoleSchema($db);
    ensureClientSchema($db);

    $stmt = $db->query("SELECT id FROM clients WHERE user_id IS NULL ORDER BY id");
    $rows = $stmt->fetchAll();
    $created = 0;

    foreach ($rows as $row) {
        $result = ensureClientProfileAccount($db, (int) $row['id']);
        if ($result && !empty($result['created'])) {
            $created++;
        }
    }

    return $created;
}

function createClientProfileAccount($db, $clientId, array $input) {
    $existing = ensureClientProfileAccount($db, (int) $clientId, $input);
    if (!$existing) {
        jsonResponse(['error' => 'Cliente no encontrado'], 404);
    }

    if (!$existing['created']) {
        if (!empty($input['password']) || !empty($input['username'])) {
            return updateClientAccess($db, (int) $clientId, $input);
        }
        jsonResponse(['error' => 'Este cliente ya tiene un perfil de acceso'], 409);
    }

    return $existing;
}

function sendClientAccessCredentials($db, $clientId, array $input = []) {
    $stmt = $db->prepare("SELECT * FROM clients WHERE id = ?");
    $stmt->execute([(int) $clientId]);
    $client = $stmt->fetch();

    if (!$client) {
        jsonResponse(['error' => 'Cliente no encontrado'], 404);
    }

    $email = trim($client['email'] ?? '');
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['error' => 'El paciente debe tener un correo válido para recibir sus accesos'], 400);
    }

    $usernameInput = trim($input['username'] ?? '');
    $ensureInput = [];
    if ($usernameInput !== '') {
        $ensureInput['username'] = $usernameInput;
    }

    $password = trim($input['password'] ?? '');
    if ($password !== '' && strlen($password) < 6) {
        jsonResponse(['error' => 'La contraseña debe tener al menos 6 caracteres'], 400);
    }

    $created = ensureClientProfileAccount($db, (int) $clientId, array_merge(
        $ensureInput,
        $password !== '' ? ['password' => $password] : []
    ));

    if ($password === '') {
        $password = defaultClientPassword((int) $clientId);
    }

    $updatePayload = ['password' => $password];
    if ($usernameInput !== '') {
        $updatePayload['username'] = $usernameInput;
    }

    $access = updateClientAccess($db, (int) $clientId, $updatePayload);

    require_once __DIR__ . '/../utils/Mailer.php';
    $emailResult = sendClientAccessEmail($client, $access['username'], $password);

    return [
        'profile' => array_merge($access, ['password' => $password]),
        'email' => $emailResult,
        'account_created' => !empty($created['created']),
    ];
}

function fetchClientProfilePayload($db, $clientId) {
    $stmt = $db->prepare("SELECT * FROM clients WHERE id = ?");
    $stmt->execute([(int) $clientId]);
    $client = $stmt->fetch();

    if (!$client) {
        return null;
    }

    $appointments = $db->prepare("
        SELECT a.*, s.name AS service_name,
               COALESCE(sc.color, s.color, '#7d7f3e') AS service_color,
               u_prof.full_name AS professional_name
        FROM appointments a
        LEFT JOIN services s ON a.service_id = s.id
        LEFT JOIN service_categories sc ON sc.id = s.category_id
        LEFT JOIN users u_prof ON u_prof.id = a.professional_id AND u_prof.role = 'profesional'
        WHERE a.client_id = ?
        ORDER BY a.appointment_date DESC, a.appointment_time DESC
    ");
    $appointments->execute([(int) $clientId]);

    $today = date('Y-m-d');
    $rows = $appointments->fetchAll();
    normalizeAppointmentRows($rows);

    return [
        'client' => hydrateClientRow($db, $client),
        'appointments' => $rows,
        'files' => fetchClientFiles($db, $clientId),
        'profile_logs' => fetchClientProfileLogs($db, $clientId),
        'stats' => [
            'total' => count($rows),
            'upcoming' => count(array_filter($rows, function ($apt) use ($today) {
                return ($apt['appointment_date'] ?? '') >= $today && ($apt['status'] ?? '') !== 'cancelled';
            })),
            'completed' => count(array_filter($rows, function ($apt) {
                return ($apt['status'] ?? '') === 'completed';
            })),
        ],
    ];
}

require_once __DIR__ . '/schema_client_files.php';
require_once __DIR__ . '/schema_client_profile_log.php';
