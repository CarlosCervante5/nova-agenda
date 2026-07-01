<?php

function ensureClientFilesSchema($db) {
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    $db->exec("CREATE TABLE IF NOT EXISTS client_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        stored_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size INT NOT NULL DEFAULT 0,
        uploaded_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_client_files_client (client_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function getClientFilesUploadDir() {
    return dirname(__DIR__, 2) . '/uploads/clients';
}

function getClientUploadDirForClient($clientId) {
    return getClientFilesUploadDir() . '/' . (int) $clientId;
}

function assertClientExpedienteAccess($db, $authUser, $clientId) {
    $clientId = (int) $clientId;

    if (isAdmin($authUser)) {
        return $clientId;
    }

    if (isCliente($authUser)) {
        $ownClientId = getClientIdForUser($db, $authUser);
        if ($ownClientId !== $clientId) {
            jsonResponse(['error' => 'No tienes permiso para ver este expediente'], 403);
        }
        return $clientId;
    }

    if (!professionalCanAccessClient($db, $authUser, $clientId)) {
        jsonResponse(['error' => 'No tienes permiso para ver este expediente'], 403);
    }

    return $clientId;
}

function canManageClientFiles($authUser) {
    return isAdmin($authUser) || isProfesional($authUser);
}

function formatClientFileRow(array $row) {
    return [
        'id' => (int) $row['id'],
        'client_id' => (int) $row['client_id'],
        'original_name' => $row['original_name'],
        'mime_type' => $row['mime_type'],
        'file_size' => (int) $row['file_size'],
        'uploaded_by' => isset($row['uploaded_by']) ? (int) $row['uploaded_by'] : null,
        'created_at' => $row['created_at'],
    ];
}

function fetchClientFiles($db, $clientId) {
    ensureClientFilesSchema($db);

    $stmt = $db->prepare("SELECT * FROM client_files WHERE client_id = ? ORDER BY created_at DESC, id DESC");
    $stmt->execute([(int) $clientId]);

    return array_map('formatClientFileRow', $stmt->fetchAll());
}

function getAllowedClientFileTypes() {
    return [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'application/msword' => 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
    ];
}

function uploadClientFile($db, $clientId, $authUser) {
    ensureClientFilesSchema($db);

    if (!canManageClientFiles($authUser)) {
        jsonResponse(['error' => 'No autorizado'], 403);
    }

    assertClientExpedienteAccess($db, $authUser, $clientId);

    if (empty($_FILES['file']) || ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        jsonResponse(['error' => 'No se recibió un archivo válido'], 400);
    }

    $file = $_FILES['file'];
    if (($file['size'] ?? 0) > 10 * 1024 * 1024) {
        jsonResponse(['error' => 'El archivo no puede superar 10 MB'], 400);
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    $allowed = getAllowedClientFileTypes();
    if (!isset($allowed[$mime])) {
        jsonResponse(['error' => 'Formato no permitido. Usa PDF, JPG, PNG, WEBP, DOC o DOCX'], 400);
    }

    $uploadDir = getClientUploadDirForClient($clientId);
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
        jsonResponse(['error' => 'No se pudo crear la carpeta de archivos'], 500);
    }

    $storedName = uniqid('file-', true) . '.' . $allowed[$mime];
    $targetPath = $uploadDir . '/' . $storedName;

    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        jsonResponse(['error' => 'No se pudo guardar el archivo'], 500);
    }

    $originalName = basename($file['name'] ?? 'archivo');
    $originalName = preg_replace('/[^\pL\pN\s._-]/u', '_', $originalName) ?: 'archivo';

    $stmt = $db->prepare("INSERT INTO client_files (client_id, original_name, stored_name, mime_type, file_size, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        (int) $clientId,
        $originalName,
        $storedName,
        $mime,
        (int) ($file['size'] ?? 0),
        (int) ($authUser['userId'] ?? 0) ?: null,
    ]);

    $fileId = (int) $db->lastInsertId();
    $stmt = $db->prepare("SELECT * FROM client_files WHERE id = ?");
    $stmt->execute([$fileId]);
    $row = $stmt->fetch();

    jsonResponse([
        'message' => 'Archivo subido correctamente',
        'file' => formatClientFileRow($row),
    ], 201);
}

function fetchClientFileRecord($db, $clientId, $fileId) {
    ensureClientFilesSchema($db);

    $stmt = $db->prepare("SELECT * FROM client_files WHERE id = ? AND client_id = ? LIMIT 1");
    $stmt->execute([(int) $fileId, (int) $clientId]);
    $row = $stmt->fetch();

    return $row ?: null;
}

function downloadClientFile($db, $clientId, $fileId, $authUser) {
    assertClientExpedienteAccess($db, $authUser, $clientId);

    $row = fetchClientFileRecord($db, $clientId, $fileId);
    if (!$row) {
        jsonResponse(['error' => 'Archivo no encontrado'], 404);
    }

    $path = getClientUploadDirForClient($clientId) . '/' . $row['stored_name'];
    if (!is_file($path)) {
        jsonResponse(['error' => 'El archivo ya no existe en el servidor'], 404);
    }

    header('Content-Type: ' . $row['mime_type']);
    header('Content-Length: ' . filesize($path));
    header('Content-Disposition: attachment; filename="' . str_replace('"', '', $row['original_name']) . '"');
    header('Cache-Control: private, max-age=0, must-revalidate');

    readfile($path);
    exit;
}

function deleteClientFile($db, $clientId, $fileId, $authUser) {
    if (!canManageClientFiles($authUser)) {
        jsonResponse(['error' => 'No autorizado'], 403);
    }

    assertClientExpedienteAccess($db, $authUser, $clientId);

    $row = fetchClientFileRecord($db, $clientId, $fileId);
    if (!$row) {
        jsonResponse(['error' => 'Archivo no encontrado'], 404);
    }

    $path = getClientUploadDirForClient($clientId) . '/' . $row['stored_name'];
    if (is_file($path)) {
        @unlink($path);
    }

    $db->prepare("DELETE FROM client_files WHERE id = ? AND client_id = ?")->execute([(int) $fileId, (int) $clientId]);

    jsonResponse(['message' => 'Archivo eliminado']);
}

function deleteAllClientFiles($db, $clientId) {
    ensureClientFilesSchema($db);

    $stmt = $db->prepare("SELECT stored_name FROM client_files WHERE client_id = ?");
    $stmt->execute([(int) $clientId]);
    $rows = $stmt->fetchAll();

    $uploadDir = getClientUploadDirForClient($clientId);
    foreach ($rows as $row) {
        $path = $uploadDir . '/' . $row['stored_name'];
        if (is_file($path)) {
            @unlink($path);
        }
    }

    $db->prepare("DELETE FROM client_files WHERE client_id = ?")->execute([(int) $clientId]);

    if (is_dir($uploadDir)) {
        @rmdir($uploadDir);
    }
}
