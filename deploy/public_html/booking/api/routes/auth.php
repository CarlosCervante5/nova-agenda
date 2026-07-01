<?php
function login($input) {
    $db = getDB();
    
    $stmt = $db->prepare("SELECT id, username, password_hash FROM users WHERE username = ?");
    $stmt->execute([$input['username'] ?? '']);
    $user = $stmt->fetch();
    
    if (!$user || !password_verify($input['password'] ?? '', $user['password_hash'])) {
        jsonResponse(['error' => 'Invalid credentials'], 401);
    }
    
    $token = JWT::encode(['userId' => $user['id'], 'username' => $user['username']]);
    jsonResponse(['token' => $token, 'user' => ['id' => $user['id'], 'username' => $user['username']]]);
}
