<?php

function ensureClientProfileLogSchema($db) {
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    $db->exec("CREATE TABLE IF NOT EXISTS client_profile_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT NOT NULL,
        field_name VARCHAR(50) NOT NULL,
        field_label VARCHAR(100) NOT NULL,
        old_value TEXT NULL,
        new_value TEXT NULL,
        changed_by INT NULL,
        changed_by_name VARCHAR(120) NOT NULL,
        changed_by_role VARCHAR(30) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_client_profile_logs_client (client_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function getClientProfileFieldLabels() {
    return [
        'name' => 'Nombre',
        'email' => 'Correo',
        'phone' => 'Teléfono',
        'notes' => 'Notas generales',
    ];
}

function resolveChangedByName($db, $authUser) {
    $userId = (int) ($authUser['userId'] ?? 0);
    if (!$userId) {
        return 'Sistema';
    }

    $stmt = $db->prepare("SELECT full_name, username FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        return 'Usuario #' . $userId;
    }

    $name = trim($user['full_name'] ?? '');
    return $name !== '' ? $name : ($user['username'] ?? 'Usuario');
}

function logClientProfileChanges($db, $clientId, array $existing, array $updated, $authUser) {
    ensureClientProfileLogSchema($db);

    $labels = getClientProfileFieldLabels();
    $changedByName = resolveChangedByName($db, $authUser);
    $changedByRole = getUserRole($authUser);
    $changedById = (int) ($authUser['userId'] ?? 0) ?: null;

    $insert = $db->prepare("INSERT INTO client_profile_logs
        (client_id, field_name, field_label, old_value, new_value, changed_by, changed_by_name, changed_by_role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

    foreach ($labels as $field => $label) {
        $oldValue = trim((string) ($existing[$field] ?? ''));
        $newValue = trim((string) ($updated[$field] ?? ''));

        if ($oldValue === $newValue) {
            continue;
        }

        $insert->execute([
            (int) $clientId,
            $field,
            $label,
            $oldValue,
            $newValue,
            $changedById,
            $changedByName,
            $changedByRole,
        ]);
    }
}

function fetchClientProfileLogs($db, $clientId, $limit = 50) {
    ensureClientProfileLogSchema($db);

    $stmt = $db->prepare("SELECT * FROM client_profile_logs WHERE client_id = ? ORDER BY created_at DESC, id DESC LIMIT ?");
    $stmt->bindValue(1, (int) $clientId, PDO::PARAM_INT);
    $stmt->bindValue(2, (int) $limit, PDO::PARAM_INT);
    $stmt->execute();

    return array_map(function ($row) {
        return [
            'id' => (int) $row['id'],
            'field_name' => $row['field_name'],
            'field_label' => $row['field_label'],
            'old_value' => $row['old_value'] ?? '',
            'new_value' => $row['new_value'] ?? '',
            'changed_by' => isset($row['changed_by']) ? (int) $row['changed_by'] : null,
            'changed_by_name' => $row['changed_by_name'],
            'changed_by_role' => $row['changed_by_role'],
            'created_at' => $row['created_at'],
        ];
    }, $stmt->fetchAll());
}

function deleteClientProfileLogs($db, $clientId) {
    ensureClientProfileLogSchema($db);
    $db->prepare("DELETE FROM client_profile_logs WHERE client_id = ?")->execute([(int) $clientId]);
}
