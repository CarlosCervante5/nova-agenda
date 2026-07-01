<?php
require_once __DIR__ . '/../config/user_services.php';
require_once __DIR__ . '/../config/schema_clients.php';
require_once __DIR__ . '/../config/schema_appointments.php';
require_once __DIR__ . '/../config/schema_client_files.php';
require_once __DIR__ . '/../config/schema_client_profile_log.php';
require_once __DIR__ . '/../middleware/auth_v3.php';

function fetchClientAppointments($db, $clientId, $authUser) {
    $where = ['a.client_id = ?'];
    $params = [(int) $clientId];

    [$where, $params] = appendProfessionalServiceFilter($where, $params, $db, $authUser, 'a.service_id');

    $sql = "SELECT a.*, s.name AS service_name,
            COALESCE(sc.color, s.color, '#7d7f3e') AS service_color,
            u_prof.full_name AS professional_name
            FROM appointments a
            LEFT JOIN services s ON a.service_id = s.id
            LEFT JOIN service_categories sc ON sc.id = s.category_id
            LEFT JOIN users u_prof ON u_prof.id = a.professional_id AND u_prof.role = 'profesional'
            WHERE " . implode(' AND ', $where) . "
            ORDER BY a.appointment_date DESC, a.appointment_time DESC";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    $rows = $stmt->fetchAll();
    normalizeAppointmentRows($rows);
    return $rows;
}

function handleClients($path, $method, $input, $authUser = null) {
    $db = getDB();
    ensureUserServicesSchema($db);
    ensureClientSchema($db);
    ensureClientFilesSchema($db);
    ensureClientProfileLogSchema($db);

    if ($path === '/clients' && $method === 'GET') {
        $search = trim($_GET['search'] ?? '');

        if (isAdmin($authUser)) {
            if ($search !== '') {
                $like = '%' . $search . '%';
                $stmt = $db->prepare("SELECT c.*, u.username AS profile_username, u.active AS profile_active
                    FROM clients c
                    LEFT JOIN users u ON u.id = c.user_id AND u.role = 'cliente'
                    WHERE c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?
                    ORDER BY c.name");
                $stmt->execute([$like, $like, $like]);
            } else {
                $stmt = $db->query("SELECT c.*, u.username AS profile_username, u.active AS profile_active
                    FROM clients c
                    LEFT JOIN users u ON u.id = c.user_id AND u.role = 'cliente'
                    ORDER BY c.name");
            }
            $rows = array_map(function ($row) use ($db) {
                return hydrateClientRow($db, $row);
            }, $stmt->fetchAll());
            jsonResponse($rows);
        }

        $where = ['1=1'];
        $params = [];

        [$where, $params] = appendProfessionalServiceFilter($where, $params, $db, $authUser, 'a.service_id');

        if ($search !== '') {
            $where[] = '(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)';
            $like = '%' . $search . '%';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $sql = "SELECT DISTINCT c.*, u.username AS profile_username, u.active AS profile_active
                FROM clients c
                INNER JOIN appointments a ON a.client_id = c.id
                LEFT JOIN users u ON u.id = c.user_id AND u.role = 'cliente'
                WHERE " . implode(' AND ', $where) . "
                ORDER BY c.name";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = array_map(function ($row) use ($db) {
            return hydrateClientRow($db, $row);
        }, $stmt->fetchAll());
        jsonResponse($rows);

    } elseif ($path === '/clients/check-unique' && $method === 'GET') {
        if (!isAdmin($authUser) && !isProfesional($authUser)) {
            jsonResponse(['error' => 'No autorizado'], 403);
        }

        $excludeId = !empty($_GET['exclude_id']) ? (int) $_GET['exclude_id'] : null;
        $duplicate = validateClientUnique(
            $db,
            $_GET['email'] ?? '',
            $_GET['phone'] ?? '',
            $excludeId
        );

        jsonResponse([
            'unique' => $duplicate === null,
            'duplicate' => $duplicate['client'] ?? null,
            'message' => $duplicate['message'] ?? null,
        ]);

    } elseif (preg_match('#^/clients/(\d+)/files/(\d+)/download$#', $path, $matches) && $method === 'GET') {
        downloadClientFile($db, (int) $matches[1], (int) $matches[2], $authUser);

    } elseif (preg_match('#^/clients/(\d+)/files/(\d+)$#', $path, $matches) && $method === 'DELETE') {
        deleteClientFile($db, (int) $matches[1], (int) $matches[2], $authUser);

    } elseif (preg_match('#^/clients/(\d+)/files$#', $path, $matches) && $method === 'POST') {
        uploadClientFile($db, (int) $matches[1], $authUser);

    } elseif (preg_match('#^/clients/(\d+)$#', $path, $matches) && $method === 'GET') {
        $clientId = (int) $matches[1];

        if (isCliente($authUser)) {
            $ownClientId = getClientIdForUser($db, $authUser);
            if ($ownClientId !== $clientId) {
                jsonResponse(['error' => 'No tienes permiso para ver este cliente'], 403);
            }
        } elseif (!isAdmin($authUser) && !professionalCanAccessClient($db, $authUser, $clientId)) {
            jsonResponse(['error' => 'No tienes permiso para ver este cliente'], 403);
        }

        if (!isCliente($authUser)) {
            ensureClientProfileAccount($db, $clientId);
        }

        $payload = fetchClientProfilePayload($db, $clientId);
        if (!$payload) {
            jsonResponse(['error' => 'Cliente no encontrado'], 404);
        }

        if (!isAdmin($authUser) && !isCliente($authUser)) {
            $payload['appointments'] = fetchClientAppointments($db, $clientId, $authUser);
        }

        if (isCliente($authUser)) {
            unset($payload['profile_logs']);
        }

        jsonResponse($payload);

    } elseif (preg_match('#^/clients/(\d+)/profile$#', $path, $matches) && $method === 'POST') {
        $clientId = (int) $matches[1];

        if (!isAdmin($authUser) && !professionalCanAccessClient($db, $authUser, $clientId)) {
            jsonResponse(['error' => 'No tienes permiso para crear el acceso de este cliente'], 403);
        }

        $result = createClientProfileAccount($db, $clientId, $input);
        jsonResponse([
            'message' => 'Perfil de cliente creado correctamente',
            'profile' => $result,
        ], 201);

    } elseif (preg_match('#^/clients/(\d+)/send-access$#', $path, $matches) && $method === 'POST') {
        $clientId = (int) $matches[1];

        if (!isAdmin($authUser) && !professionalCanAccessClient($db, $authUser, $clientId)) {
            jsonResponse(['error' => 'No tienes permiso para enviar accesos a este paciente'], 403);
        }

        $result = sendClientAccessCredentials($db, $clientId, $input);
        $sent = !empty($result['email']['sent']);
        jsonResponse([
            'message' => $sent
                ? 'Accesos enviados al correo del paciente'
                : 'Cuenta preparada, pero no se pudo enviar el correo',
            'profile' => $result['profile'],
            'email' => $result['email'],
            'account_created' => $result['account_created'],
        ], $sent ? 200 : 502);

    } elseif ($path === '/clients' && $method === 'POST') {
        if (isCliente($authUser)) {
            jsonResponse(['error' => 'No autorizado'], 403);
        }

        $client = saveClientRecord($db, $input);
        ensureClientProfileAccount($db, (int) $client['id']);
        jsonResponse(['id' => (int) $client['id'], 'client' => hydrateClientRow($db, $client), 'message' => 'Client created'], 201);

    } elseif (preg_match('#^/clients/(\d+)$#', $path, $matches) && $method === 'PUT') {
        $clientId = (int) $matches[1];

        $existingStmt = $db->prepare("SELECT * FROM clients WHERE id = ?");
        $existingStmt->execute([$clientId]);
        $existing = $existingStmt->fetch();
        if (!$existing) {
            jsonResponse(['error' => 'Cliente no encontrado'], 404);
        }

        if (isCliente($authUser)) {
            $ownClientId = getClientIdForUser($db, $authUser);
            if ($ownClientId !== $clientId) {
                jsonResponse(['error' => 'No tienes permiso para editar este cliente'], 403);
            }

            $client = saveClientRecord($db, [
                'name' => $input['name'] ?? $existing['name'],
                'email' => $input['email'] ?? $existing['email'],
                'phone' => $input['phone'] ?? $existing['phone'],
                'notes' => array_key_exists('notes', $input) ? $input['notes'] : $existing['notes'],
            ], $clientId, $authUser);

            if (array_key_exists('username', $input) || !empty($input['password'])) {
                updateClientAccess($db, $clientId, $input);
            }

            jsonResponse(['message' => 'Perfil actualizado', 'client' => hydrateClientRow($db, $client)]);
        }

        if (!isAdmin($authUser)) {
            if (!professionalCanAccessClient($db, $authUser, $clientId)) {
                jsonResponse(['error' => 'No tienes permiso para editar este cliente'], 403);
            }

            $client = saveClientRecord($db, [
                'name' => $input['name'] ?? $existing['name'],
                'email' => $input['email'] ?? $existing['email'],
                'phone' => $input['phone'] ?? $existing['phone'],
                'notes' => array_key_exists('notes', $input) ? $input['notes'] : $existing['notes'],
            ], $clientId, $authUser);

            if (array_key_exists('username', $input) || !empty($input['password'])) {
                updateClientAccess($db, $clientId, $input);
            }

            jsonResponse([
                'message' => 'Perfil actualizado',
                'client' => hydrateClientRow($db, $client),
                'profile_logs' => fetchClientProfileLogs($db, $clientId),
            ]);
        }

        if (!isset($input['name'])) {
            $client = saveClientRecord($db, [
                'name' => $existing['name'],
                'email' => $existing['email'],
                'phone' => $existing['phone'],
                'notes' => $input['notes'] ?? $existing['notes'],
            ], $clientId, $authUser);
            jsonResponse(['message' => 'Expediente actualizado', 'client' => hydrateClientRow($db, $client)]);
        }

        $client = saveClientRecord($db, $input, $clientId, $authUser);
        if (array_key_exists('username', $input) || !empty($input['password'])) {
            updateClientAccess($db, $clientId, $input);
        }
        jsonResponse(['message' => 'Client updated', 'client' => hydrateClientRow($db, $client)]);

    } elseif (preg_match('#/clients/(\d+)#', $path, $matches) && $method === 'DELETE') {
        if (!isAdmin($authUser)) {
            jsonResponse(['error' => 'No autorizado'], 403);
        }

        $clientId = (int) $matches[1];
        $userStmt = $db->prepare("SELECT user_id FROM clients WHERE id = ?");
        $userStmt->execute([$clientId]);
        $userId = (int) $userStmt->fetchColumn();

        deleteAllClientFiles($db, $clientId);
        deleteClientProfileLogs($db, $clientId);
        $db->prepare("DELETE FROM clients WHERE id = ?")->execute([$clientId]);
        if ($userId) {
            $db->prepare("DELETE FROM users WHERE id = ? AND role = 'cliente'")->execute([$userId]);
        }
        jsonResponse(['message' => 'Client deleted']);
    }
}
