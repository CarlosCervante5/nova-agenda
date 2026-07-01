<?php
require_once __DIR__ . '/../config/user_services.php';
require_once __DIR__ . '/../config/professional_profile.php';
require_once __DIR__ . '/../config/schema_appointments.php';

function appointmentSelectSql() {
    return "SELECT a.*, s.name as service_name,
            COALESCE(sc.color, s.color, '#7d7f3e') as service_color,
            c.name as client_name, c.email as client_email, c.phone as client_phone,
            c.user_id AS client_user_id,
            u_prof.full_name AS professional_name
            FROM appointments a
            LEFT JOIN services s ON a.service_id = s.id
            LEFT JOIN service_categories sc ON sc.id = s.category_id
            LEFT JOIN clients c ON a.client_id = c.id
            LEFT JOIN users u_prof ON u_prof.id = a.professional_id AND u_prof.role = 'profesional'";
}

function resolveAppointmentProfessionalId($db, $authUser, array $input, $serviceId) {
    if ($authUser && !isAdmin($authUser) && !isCliente($authUser)) {
        return (int) ($authUser['userId'] ?? 0) ?: null;
    }

    if (!empty($input['professional_id'])) {
        $professionalId = (int) $input['professional_id'];
        if ($professionalId > 0) {
            $stmt = $db->prepare("SELECT id FROM users WHERE id = ? AND role = 'profesional' AND active = 1");
            $stmt->execute([$professionalId]);
            if ($stmt->fetch()) {
                return $professionalId;
            }
        }
    }

    return null;
}

function handleAppointments($path, $method, $input, $authUser = null) {
    $db = getDB();
    ensureUserServicesSchema($db);
    ensureProfessionalProfileSchema($db);
    ensureAppointmentSchema($db);

    if ($path === '/appointments' && $method === 'GET') {
        $where = [];
        $params = [];

        $dateField = ($_GET['date_field'] ?? 'appointment') === 'created' ? 'created' : 'appointment';
        $sortBy = ($_GET['sort_by'] ?? 'appointment') === 'created' ? 'created' : 'appointment';

        if (!empty($_GET['dateFrom'])) {
            if ($dateField === 'created') {
                $where[] = 'DATE(a.created_at) >= ?';
            } else {
                $where[] = 'a.appointment_date >= ?';
            }
            $params[] = $_GET['dateFrom'];
        }
        if (!empty($_GET['dateTo'])) {
            if ($dateField === 'created') {
                $where[] = 'DATE(a.created_at) <= ?';
            } else {
                $where[] = 'a.appointment_date <= ?';
            }
            $params[] = $_GET['dateTo'];
        }
        if (!empty($_GET['date'])) {
            if ($dateField === 'created') {
                $where[] = 'DATE(a.created_at) = ?';
            } else {
                $where[] = 'a.appointment_date = ?';
            }
            $params[] = $_GET['date'];
        }
        if (!empty($_GET['status'])) { $where[] = 'a.status = ?'; $params[] = $_GET['status']; }
        if (!empty($_GET['client_id'])) { $where[] = 'a.client_id = ?'; $params[] = (int) $_GET['client_id']; }

        if ($authUser && isCliente($authUser)) {
            require_once __DIR__ . '/../config/schema_clients.php';
            ensureClientSchema($db);
            $clientId = getClientIdForUser($db, $authUser);
            if (!$clientId) {
                jsonResponse([]);
            }
            $where[] = 'a.client_id = ?';
            $params[] = $clientId;
        } elseif ($authUser) {
            [$where, $params] = appendProfessionalServiceFilter($where, $params, $db, $authUser, 'a.service_id');
        }

        $sql = appointmentSelectSql();
        if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
        if ($sortBy === 'created') {
            $sql .= ' ORDER BY a.created_at DESC, a.id DESC';
        } else {
            $sql .= ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';
        }

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        normalizeAppointmentRows($rows);
        jsonResponse($rows);

    } elseif ($path === '/appointments/stats' && $method === 'GET') {
        $today = date('Y-m-d');
        $weekStart = date('Y-m-d', strtotime('monday this week'));
        $weekEnd = date('Y-m-d', strtotime('sunday this week'));

        $serviceFilterSql = '';
        $serviceParams = [];
        $isProfessional = $authUser && !isAdmin($authUser) && !isCliente($authUser);

        if ($isProfessional) {
            $serviceIds = getUserServiceIds($db, (int) ($authUser['userId'] ?? 0));
            if (!$serviceIds) {
                jsonResponse([
                    'today' => 0,
                    'thisWeek' => 0,
                    'scheduled' => 0,
                    'cancelled' => 0,
                    'pending' => 0,
                    'confirmed' => 0,
                    'completed' => 0,
                    'totalClients' => 0,
                ]);
            }
            $placeholders = implode(',', array_fill(0, count($serviceIds), '?'));
            $serviceFilterSql = " AND service_id IN ($placeholders)";
            $serviceParams = $serviceIds;
        }

        $stmt = $db->prepare("SELECT COUNT(*) as count FROM appointments WHERE appointment_date = ? AND status != 'cancelled'{$serviceFilterSql}");
        $stmt->execute(array_merge([$today], $serviceParams));
        $todayCount = (int) $stmt->fetch()['count'];

        $stmt = $db->prepare("SELECT COUNT(*) as count FROM appointments WHERE appointment_date BETWEEN ? AND ? AND status != 'cancelled'{$serviceFilterSql}");
        $stmt->execute(array_merge([$weekStart, $weekEnd], $serviceParams));
        $weekCount = (int) $stmt->fetch()['count'];

        $stmt = $db->prepare("SELECT COUNT(*) as count FROM appointments WHERE status != 'cancelled'{$serviceFilterSql}");
        $stmt->execute($serviceParams);
        $scheduledCount = (int) $stmt->fetch()['count'];

        $stmt = $db->prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'cancelled'{$serviceFilterSql}");
        $stmt->execute($serviceParams);
        $cancelledCount = (int) $stmt->fetch()['count'];

        $stmt = $db->prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'pending'{$serviceFilterSql}");
        $stmt->execute($serviceParams);
        $pendingCount = (int) $stmt->fetch()['count'];

        $stmt = $db->prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'confirmed'{$serviceFilterSql}");
        $stmt->execute($serviceParams);
        $confirmedCount = (int) $stmt->fetch()['count'];

        $stmt = $db->prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'completed'{$serviceFilterSql}");
        $stmt->execute($serviceParams);
        $completedCount = (int) $stmt->fetch()['count'];

        if ($isProfessional) {
            $stmt = $db->prepare("SELECT COUNT(DISTINCT client_id) as count FROM appointments WHERE service_id IN ($placeholders)");
            $stmt->execute($serviceIds);
            $totalClients = (int) $stmt->fetch()['count'];
        } else {
            $totalClients = (int) $db->query("SELECT COUNT(*) as count FROM clients")->fetch()['count'];
        }

        jsonResponse([
            'today' => $todayCount,
            'thisWeek' => $weekCount,
            'scheduled' => $scheduledCount,
            'cancelled' => $cancelledCount,
            'pending' => $pendingCount,
            'confirmed' => $confirmedCount,
            'completed' => $completedCount,
            'totalClients' => $totalClients,
        ]);

    } elseif ($path === '/appointments' && $method === 'POST') {
        if ($authUser && isCliente($authUser)) {
            jsonResponse(['error' => 'No tienes permiso para crear citas'], 403);
        }

        $serviceId = (int) ($input['service_id'] ?? 0);
        if ($authUser && !userCanAccessService($db, $authUser, $serviceId)) {
            jsonResponse(['error' => 'No tienes permiso para agendar este servicio'], 403);
        }

        if ($authUser && !isAdmin($authUser)) {
            $clientId = (int) ($input['client_id'] ?? 0);
            if (!$clientId || !professionalCanBookClient($db, $authUser, $clientId)) {
                jsonResponse(['error' => 'No tienes permiso para agendar con este cliente'], 403);
            }
        }

        $professionalId = resolveAppointmentProfessionalId($db, $authUser, $input, $serviceId);

        $stmt = $db->prepare("INSERT INTO appointments (service_id, professional_id, client_id, appointment_date, appointment_time, duration_minutes, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $input['service_id'], $professionalId, $input['client_id'],
            $input['appointment_date'] ?? $input['date'],
            $input['appointment_time'] ?? $input['time'],
            $input['duration_minutes'] ?? $input['duration'] ?? 60,
            $input['status'] ?? 'pending',
            $input['notes'] ?? ''
        ]);
        jsonResponse(['id' => $db->lastInsertId(), 'message' => 'Appointment created'], 201);

    } elseif (preg_match('#/appointments/(\d+)#', $path, $matches) && $method === 'PUT') {
        if ($authUser && isCliente($authUser)) {
            jsonResponse(['error' => 'No tienes permiso para editar citas'], 403);
        }

        $id = $matches[1];
        $oldStatus = null;
        $newStatus = null;

        $existingStmt = $db->prepare("SELECT * FROM appointments WHERE id = ?");
        $existingStmt->execute([$id]);
        $existing = $existingStmt->fetch();
        if (!$existing) {
            jsonResponse(['error' => 'Cita no encontrada'], 404);
        }

        if ($authUser && !isAdmin($authUser)) {
            if (!userCanAccessService($db, $authUser, $existing['service_id'])) {
                jsonResponse(['error' => 'No tienes permiso para editar esta cita'], 403);
            }
            if (isset($input['service_id']) && !userCanAccessService($db, $authUser, $input['service_id'])) {
                jsonResponse(['error' => 'No tienes permiso para asignar este servicio'], 403);
            }
            $allowed = ['status', 'notes', 'appointment_date', 'date', 'appointment_time', 'time', 'service_id', 'duration_minutes', 'duration'];
            $input = array_intersect_key($input, array_flip($allowed));
        }

        if (isAdmin($authUser) && array_key_exists('professional_id', $input)) {
            $input['professional_id'] = $input['professional_id'] ? (int) $input['professional_id'] : null;
        }

        if (isset($input['status'])) {
            if (!isValidAppointmentStatus($input['status'])) {
                jsonResponse(['error' => 'Estatus de cita no válido'], 400);
            }
            $oldStatus = $existing['status'];
            $newStatus = $input['status'];
        }

        $fields = [];
        $values = [];

        $map = [
            'service_id' => 'service_id', 'client_id' => 'client_id', 'professional_id' => 'professional_id',
            'appointment_date' => 'appointment_date', 'date' => 'appointment_date',
            'appointment_time' => 'appointment_time', 'time' => 'appointment_time',
            'duration_minutes' => 'duration_minutes', 'duration' => 'duration_minutes',
            'status' => 'status', 'notes' => 'notes'
        ];

        foreach ($map as $inputKey => $dbCol) {
            if (isset($input[$inputKey]) && !in_array($dbCol, $fields)) {
                $fields[] = "$dbCol = ?";
                $values[] = $input[$inputKey];
            }
        }
        if ($fields) {
            $values[] = $id;
            $db->prepare("UPDATE appointments SET " . implode(', ', $fields) . " WHERE id = ?")->execute($values);
        }

        if ($oldStatus !== null && $newStatus !== null && $oldStatus !== $newStatus) {
            require_once __DIR__ . '/../utils/Mailer.php';
            sendAppointmentStatusEmail((int) $id, $newStatus);
        }

        jsonResponse(['message' => 'Appointment updated']);

    } elseif (preg_match('#/appointments/(\d+)#', $path, $matches) && $method === 'DELETE') {
        if ($authUser && !isAdmin($authUser)) {
            jsonResponse(['error' => 'No tienes permiso para eliminar citas'], 403);
        }

        $db->prepare("DELETE FROM appointments WHERE id = ?")->execute([$matches[1]]);
        jsonResponse(['message' => 'Appointment deleted']);
    }
}
