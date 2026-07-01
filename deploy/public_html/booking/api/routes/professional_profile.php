<?php

function ensureProfessionalProfileSchema($db) {
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    $columns = [
        'profile_photo' => "ALTER TABLE users ADD COLUMN profile_photo VARCHAR(255) NULL AFTER full_name",
        'profile_bio' => "ALTER TABLE users ADD COLUMN profile_bio TEXT NULL AFTER profile_photo",
        'booking_slug' => "ALTER TABLE users ADD COLUMN booking_slug VARCHAR(80) NULL AFTER profile_bio",
    ];

    foreach ($columns as $column => $sql) {
        $stmt = $db->query("SHOW COLUMNS FROM users LIKE '{$column}'");
        if (!$stmt->fetch()) {
            $db->exec($sql);
        }
    }

    $stmt = $db->query("SHOW INDEX FROM users WHERE Key_name = 'uniq_users_booking_slug'");
    if (!$stmt->fetch()) {
        $db->exec("CREATE UNIQUE INDEX uniq_users_booking_slug ON users (booking_slug)");
    }

    $stmt = $db->query("SHOW COLUMNS FROM appointments LIKE 'professional_id'");
    if (!$stmt->fetch()) {
        $db->exec("ALTER TABLE appointments ADD COLUMN professional_id INT NULL AFTER service_id");
        $db->exec("ALTER TABLE appointments ADD KEY idx_appointments_professional (professional_id)");
    }
}

function getUploadsBaseDir() {
    return dirname(__DIR__, 2) . '/uploads/professionals';
}

function getPublicUploadsBaseUrl() {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    return $scheme . '://' . $host . '/booking/uploads/professionals';
}

function normalizeBookingSlug($value) {
    $slug = strtolower(trim((string) $value));
    $slug = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $slug);
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);
    $slug = trim($slug, '-');
    return substr($slug, 0, 80);
}

function buildProfessionalBookingUrl(array $user) {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $base = $scheme . '://' . $host . '/booking/public/';

    if (!empty($user['booking_slug'])) {
        return $base . '?p=' . rawurlencode($user['booking_slug']);
    }

    return $base . '?professional=' . (int) ($user['id'] ?? 0);
}

function appendProfessionalProfileFields(array $user) {
    if (!empty($user['profile_photo']) && strpos($user['profile_photo'], 'http') !== 0) {
        $user['profile_photo_url'] = getPublicUploadsBaseUrl() . '/' . ltrim($user['profile_photo'], '/');
    } else {
        $user['profile_photo_url'] = $user['profile_photo'] ?? '';
    }

    $user['booking_url'] = buildProfessionalBookingUrl($user);
    return $user;
}

function resolvePublicProfessionalId($db) {
    ensureProfessionalProfileSchema($db);

    if (!empty($_GET['professional'])) {
        return (int) $_GET['professional'];
    }

    $slug = trim((string) ($_GET['p'] ?? $_GET['slug'] ?? ''));
    if ($slug === '') {
        return 0;
    }

    $stmt = $db->prepare("SELECT id FROM users WHERE booking_slug = ? AND role = 'profesional' AND active = 1 LIMIT 1");
    $stmt->execute([$slug]);
    $row = $stmt->fetch();

    return $row ? (int) $row['id'] : 0;
}

function fetchPublicProfessional($db, $professionalId) {
    ensureProfessionalProfileSchema($db);
    ensureUserServicesSchema($db);

    $stmt = $db->prepare("
        SELECT id, full_name, profile_photo, profile_bio, booking_slug
        FROM users
        WHERE id = ? AND role = 'profesional' AND active = 1
    ");
    $stmt->execute([(int) $professionalId]);
    $user = $stmt->fetch();

    if (!$user) {
        return null;
    }

    $user['id'] = (int) $user['id'];
    $user['service_ids'] = getUserServiceIds($db, $user['id']);

    if (!$user['service_ids']) {
        return null;
    }

    return appendProfessionalProfileFields($user);
}

function validateBookingSlug($db, $slug, $userId = 0) {
    if ($slug === '') {
        return '';
    }

    if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug)) {
        jsonResponse(['error' => 'El enlace personalizado solo puede usar letras minúsculas, números y guiones'], 400);
    }

    $stmt = $db->prepare("SELECT id FROM users WHERE booking_slug = ? AND id != ? LIMIT 1");
    $stmt->execute([$slug, (int) $userId]);
    if ($stmt->fetch()) {
        jsonResponse(['error' => 'Ese enlace personalizado ya está en uso'], 409);
    }

    return $slug;
}

function isAppointmentSlotTaken($db, $date, $time, $professionalId = null) {
    if ($professionalId) {
        $stmt = $db->prepare("
            SELECT id FROM appointments
            WHERE appointment_date = ? AND appointment_time = ? AND status != 'cancelled'
              AND professional_id = ?
        ");
        $stmt->execute([$date, $time, (int) $professionalId]);
        return (bool) $stmt->fetch();
    }

    $stmt = $db->prepare("
        SELECT id FROM appointments
        WHERE appointment_date = ? AND appointment_time = ? AND status != 'cancelled'
    ");
    $stmt->execute([$date, $time]);
    return (bool) $stmt->fetch();
}

function handleProfessionalPhotoUpload($db, $userId) {
    ensureProfessionalProfileSchema($db);

    $user = fetchUserWithServices($db, $userId);
    if (!$user) {
        jsonResponse(['error' => 'Profesional no encontrado'], 404);
    }

    if (empty($_FILES['photo']) || ($_FILES['photo']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        jsonResponse(['error' => 'No se recibió una imagen válida'], 400);
    }

    $file = $_FILES['photo'];
    if (($file['size'] ?? 0) > 5 * 1024 * 1024) {
        jsonResponse(['error' => 'La imagen no puede superar 5 MB'], 400);
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    if (!isset($allowed[$mime])) {
        jsonResponse(['error' => 'Formato no permitido. Usa JPG, PNG o WEBP'], 400);
    }

    $uploadDir = getUploadsBaseDir();
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
        jsonResponse(['error' => 'No se pudo crear la carpeta de uploads'], 500);
    }

    $filename = 'professional-' . (int) $userId . '.' . $allowed[$mime];
    $targetPath = $uploadDir . '/' . $filename;

    foreach (glob($uploadDir . '/professional-' . (int) $userId . '.*') as $oldFile) {
        if ($oldFile !== $targetPath) {
            @unlink($oldFile);
        }
    }

    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        jsonResponse(['error' => 'No se pudo guardar la imagen'], 500);
    }

    $db->prepare("UPDATE users SET profile_photo = ? WHERE id = ?")->execute([$filename, (int) $userId]);

    $updated = fetchUserWithServices($db, $userId);
    jsonResponse([
        'message' => 'Foto actualizada',
        'profile_photo' => $updated['profile_photo'] ?? $filename,
        'profile_photo_url' => $updated['profile_photo_url'] ?? '',
        'user' => $updated,
    ]);
}

function deleteProfessionalPhoto($db, $userId) {
    $user = fetchUserWithServices($db, $userId);
    if (!$user) {
        jsonResponse(['error' => 'Profesional no encontrado'], 404);
    }

    removeProfessionalPhotoFiles((int) $userId);

    $db->prepare("UPDATE users SET profile_photo = NULL WHERE id = ?")->execute([(int) $userId]);
    jsonResponse(['message' => 'Foto eliminada', 'user' => fetchUserWithServices($db, $userId)]);
}

function removeProfessionalPhotoFiles($userId) {
    $uploadDir = getUploadsBaseDir();
    foreach (glob($uploadDir . '/professional-' . (int) $userId . '.*') as $oldFile) {
        @unlink($oldFile);
    }
}

function deleteProfessionalAccount($db, $userId) {
    $user = fetchUserWithServices($db, (int) $userId);
    if (!$user) {
        jsonResponse(['error' => 'Profesional no encontrado'], 404);
    }

    if ($user['username'] === 'profesional') {
        jsonResponse(['error' => 'No se puede eliminar el usuario principal'], 400);
    }

    removeProfessionalPhotoFiles((int) $userId);
    $db->prepare("UPDATE appointments SET professional_id = NULL WHERE professional_id = ?")->execute([(int) $userId]);
    $db->prepare("DELETE FROM users WHERE id = ? AND role = 'profesional'")->execute([(int) $userId]);

    jsonResponse(['message' => 'Profesional eliminado']);
}
