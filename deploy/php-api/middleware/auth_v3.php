<?php
require_once __DIR__ . '/../config/database_v3.php';

class JWT {
    public static function encode($payload) {
        $header = self::base64url(['alg' => 'HS256', 'typ' => 'JWT']);
        $payload['iat'] = time();
        $payload['exp'] = time() + (24 * 60 * 60); // 24 hours
        $payload = self::base64url($payload);
        $signature = self::base64url(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
        return "$header.$payload.$signature";
    }

    public static function decode($token) {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;
        
        [$header, $payload, $signature] = $parts;
        $expected = self::base64url(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
        
        if (!hash_equals($expected, $signature)) return null;
        
        $payload = json_decode(base64_decode(strtr($payload, '-_', '+/')), true);
        
        if ($payload['exp'] < time()) return null;
        
        return $payload;
    }

    private static function base64url($data) {
        if (is_array($data)) $data = json_encode($data);
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}

// Auth middleware
function authenticate() {
    $headers = getallheaders();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    
    if (preg_match('/Bearer\s+(.*)$/i', $auth, $matches)) {
        $token = JWT::decode($matches[1]);
        if ($token) return $token;
    }
    
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// JSON response helper
function jsonResponse($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function normalizeRole($role) {
    if ($role === 'staff') {
        return 'profesional';
    }
    return $role ?: 'profesional';
}

function getUserRole($user) {
    if (!empty($user['role'])) {
        return normalizeRole($user['role']);
    }

    if (empty($user['userId'])) {
        return 'profesional';
    }

    $db = getDB();
    $stmt = $db->prepare("SELECT role FROM users WHERE id = ? AND active = 1");
    $stmt->execute([(int) $user['userId']]);
    $row = $stmt->fetch();

    return normalizeRole($row['role'] ?? 'profesional');
}

function isAdmin($user) {
    return getUserRole($user) === 'admin';
}

function isCliente($user) {
    return getUserRole($user) === 'cliente';
}

function isProfesional($user) {
    return getUserRole($user) === 'profesional';
}

function requireAdmin($user) {
    if (!isAdmin($user)) {
        jsonResponse(['error' => 'Acceso denegado. Se requiere rol administrador.'], 403);
    }
}
