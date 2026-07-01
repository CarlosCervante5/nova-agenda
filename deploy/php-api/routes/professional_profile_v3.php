<?php
require_once __DIR__ . '/../config/user_accounts.php';
require_once __DIR__ . '/../config/user_services.php';
require_once __DIR__ . '/../config/professional_profile.php';
require_once __DIR__ . '/../middleware/auth_v3.php';

function handleProfessionalProfile($path, $method, $input, $authUser) {
    if (!isProfesional($authUser)) {
        jsonResponse(['error' => 'Acceso denegado'], 403);
    }

    $db = getDB();
    ensureProfessionalProfileSchema($db);
    $userId = (int) ($authUser['userId'] ?? 0);

    if ($path === '/professional/profile' && $method === 'GET') {
        $user = fetchUserWithServices($db, $userId);
        if (!$user) {
            jsonResponse(['error' => 'Perfil no encontrado'], 404);
        }
        jsonResponse(['user' => $user]);
    }

    if ($path === '/professional/profile' && $method === 'PUT') {
        $existing = fetchUserWithServices($db, $userId);
        if (!$existing) {
            jsonResponse(['error' => 'Perfil no encontrado'], 404);
        }

        $updateInput = [
            'username' => $existing['username'],
            'email' => trim($input['email'] ?? $existing['email']),
            'full_name' => trim($input['full_name'] ?? $existing['full_name']),
            'active' => (int) $existing['active'],
            'profile_bio' => trim((string) ($input['profile_bio'] ?? $existing['profile_bio'] ?? '')),
            'booking_slug' => $input['booking_slug'] ?? $existing['booking_slug'] ?? '',
        ];

        if (!empty($input['password'])) {
            if (strlen($input['password']) < 6) {
                jsonResponse(['error' => 'La contraseña debe tener al menos 6 caracteres'], 400);
            }
            $updateInput['password'] = $input['password'];
        }

        updateUserAccount($db, $userId, $updateInput, $existing, ['profesional']);

        jsonResponse([
            'message' => 'Perfil actualizado',
            'user' => fetchUserWithServices($db, $userId),
        ]);
    }

    if ($path === '/professional/profile/photo' && $method === 'POST') {
        handleProfessionalPhotoUpload($db, $userId);
    }

    if ($path === '/professional/profile/photo' && $method === 'DELETE') {
        deleteProfessionalPhoto($db, $userId);
    }

    if ($path === '/professional/password' && $method === 'PUT') {
        $password = $input['password'] ?? '';
        if (strlen($password) < 6) {
            jsonResponse(['error' => 'La contraseña debe tener al menos 6 caracteres'], 400);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        $db->prepare("UPDATE users SET password_hash = ? WHERE id = ? AND role = 'profesional'")
            ->execute([$hash, $userId]);

        jsonResponse(['message' => 'Contraseña actualizada']);
    }

    jsonResponse(['error' => 'Not found'], 404);
}
