<?php

require_once __DIR__ . '/schema_roles.php';
require_once __DIR__ . '/professional_profile.php';

function fetchAdminUser($db, $userId) {
    $stmt = $db->prepare("
        SELECT id, username, email, full_name, role, active, created_at
        FROM users
        WHERE id = ? AND role = 'admin'
    ");
    $stmt->execute([(int) $userId]);
    $user = $stmt->fetch();
    if (!$user) {
        return null;
    }

    $user['id'] = (int) $user['id'];
    $user['active'] = (int) $user['active'];
    $user['role'] = normalizeRole($user['role']);

    return $user;
}

function createUserAccount($db, array $input, $role) {
    $username = trim($input['username'] ?? '');
    $email = trim($input['email'] ?? '');
    $fullName = trim($input['full_name'] ?? '');
    $password = $input['password'] ?? '';

    if (!$username || !$email || !$fullName || !$password) {
        jsonResponse(['error' => 'Usuario, correo, nombre y contraseña son obligatorios'], 400);
    }

    $stmt = $db->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
    $stmt->execute([$username, $email]);
    if ($stmt->fetch()) {
        jsonResponse(['error' => 'El usuario o correo ya existe'], 409);
    }

    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    $stmt = $db->prepare("
        INSERT INTO users (username, email, password_hash, full_name, role, active)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $username,
        $email,
        $hash,
        $fullName,
        $role,
        isset($input['active']) ? (int) (bool) $input['active'] : 1,
    ]);

    return (int) $db->lastInsertId();
}

function updateUserAccount($db, $userId, array $input, $existing, array $protectedUsernames = []) {
    $username = trim($input['username'] ?? $existing['username']);
    $email = trim($input['email'] ?? $existing['email']);
    $fullName = trim($input['full_name'] ?? $existing['full_name']);
    $active = isset($input['active']) ? (int) (bool) $input['active'] : (int) $existing['active'];

    if (!$username || !$email || !$fullName) {
        jsonResponse(['error' => 'Usuario, correo y nombre son obligatorios'], 400);
    }

    if (in_array($existing['username'], $protectedUsernames, true) && $username !== $existing['username']) {
        jsonResponse(['error' => 'No se puede cambiar el usuario principal'], 400);
    }

    $stmt = $db->prepare("SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?");
    $stmt->execute([$username, $email, $userId]);
    if ($stmt->fetch()) {
        jsonResponse(['error' => 'El usuario o correo ya existe'], 409);
    }

    $fields = ['username = ?', 'email = ?', 'full_name = ?', 'active = ?'];
    $values = [$username, $email, $fullName, $active];

    if (!empty($input['password'])) {
        $fields[] = 'password_hash = ?';
        $values[] = password_hash($input['password'], PASSWORD_BCRYPT, ['cost' => 12]);
    }

    if (array_key_exists('profile_bio', $input)) {
        $fields[] = 'profile_bio = ?';
        $values[] = trim((string) $input['profile_bio']);
    }

    if (array_key_exists('booking_slug', $input)) {
        ensureProfessionalProfileSchema($db);
        $slug = normalizeBookingSlug($input['booking_slug']);
        $fields[] = 'booking_slug = ?';
        $values[] = $slug !== '' ? validateBookingSlug($db, $slug, $userId) : null;
    }

    $values[] = $userId;
    $db->prepare("UPDATE users SET " . implode(', ', $fields) . " WHERE id = ?")->execute($values);
}
