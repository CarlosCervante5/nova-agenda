<?php
require_once __DIR__ . '/../config/schema_clients.php';
require_once __DIR__ . '/../middleware/auth_v3.php';

function handleClientProfile($path, $method, $input, $authUser) {
    if (!isCliente($authUser)) {
        jsonResponse(['error' => 'Acceso denegado'], 403);
    }

    $db = getDB();
    ensureClientSchema($db);
    $clientId = getClientIdForUser($db, $authUser);

    if (!$clientId) {
        jsonResponse(['error' => 'Perfil de cliente no vinculado'], 404);
    }

    if ($path === '/client/profile' && $method === 'GET') {
        $payload = fetchClientProfilePayload($db, $clientId);
        if (!$payload) {
            jsonResponse(['error' => 'Perfil no encontrado'], 404);
        }
        unset($payload['profile_logs']);
        jsonResponse($payload);
    }

    if ($path === '/client/profile' && $method === 'PUT') {
        $stmt = $db->prepare("SELECT notes FROM clients WHERE id = ?");
        $stmt->execute([$clientId]);
        $existingNotes = $stmt->fetchColumn() ?: '';

        $client = saveClientRecord($db, [
            'name' => $input['name'] ?? '',
            'email' => $input['email'] ?? '',
            'phone' => $input['phone'] ?? '',
            'notes' => $existingNotes,
        ], $clientId);

        $saved = hydrateClientRow($db, $client);
        unset($saved['notes']);

        jsonResponse([
            'message' => 'Perfil actualizado',
            'client' => $saved,
        ]);
    }

    if ($path === '/client/password' && $method === 'PUT') {
        $password = $input['password'] ?? '';
        if (strlen($password) < 6) {
            jsonResponse(['error' => 'La contraseña debe tener al menos 6 caracteres'], 400);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        $db->prepare("UPDATE users SET password_hash = ? WHERE id = ? AND role = 'cliente'")
            ->execute([$hash, (int) ($authUser['userId'] ?? 0)]);

        jsonResponse(['message' => 'Contraseña actualizada']);
    }

    jsonResponse(['error' => 'Not found'], 404);
}
