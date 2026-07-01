<?php

function ensureRoleSchema($db) {
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    $stmt = $db->query("SHOW COLUMNS FROM users LIKE 'role'");
    $column = $stmt->fetch();
    if (!$column) {
        return;
    }

    $type = $column['Type'] ?? '';
    if (strpos($type, 'cliente') === false) {
        if (strpos($type, 'staff') !== false) {
            $db->exec("UPDATE users SET role = 'profesional' WHERE role = 'staff'");
        }
        if (strpos($type, 'profesional') === false) {
            $db->exec("ALTER TABLE users MODIFY role ENUM('admin','profesional') NOT NULL DEFAULT 'profesional'");
        }
        $db->exec("ALTER TABLE users MODIFY role ENUM('admin','profesional','cliente') NOT NULL DEFAULT 'profesional'");
    }

    $defaultProfesionalHash = password_hash('profesional123', PASSWORD_BCRYPT, ['cost' => 12]);

    $stmt = $db->prepare("SELECT id, password_hash, full_name, role FROM users WHERE username = ? LIMIT 1");
    $stmt->execute(['profesional']);
    $profesionalUser = $stmt->fetch();

    if (!$profesionalUser) {
        $insert = $db->prepare("INSERT INTO users (username, email, password_hash, full_name, role, active) VALUES (?, ?, ?, ?, ?, 1)");
        $insert->execute([
            'profesional',
            'profesional@tapaicentro.com',
            $defaultProfesionalHash,
            'Profesional Tapai',
            'profesional',
        ]);
    } else {
        if (($profesionalUser['role'] ?? '') !== 'profesional') {
            $db->prepare("UPDATE users SET role = 'profesional' WHERE id = ?")->execute([(int) $profesionalUser['id']]);
        }

        $needsPasswordRepair = !password_verify('profesional123', $profesionalUser['password_hash'] ?? '')
            && ($profesionalUser['full_name'] ?? '') === 'Profesional Tapai';

        if ($needsPasswordRepair) {
            $db->prepare("UPDATE users SET password_hash = ? WHERE id = ?")->execute([
                $defaultProfesionalHash,
                (int) $profesionalUser['id'],
            ]);
        }
    }

    $db->exec("UPDATE users SET role = 'admin' WHERE username = 'admin' AND (role IS NULL OR role = '')");
}
