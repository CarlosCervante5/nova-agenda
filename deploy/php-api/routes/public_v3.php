<?php
require_once __DIR__ . '/../config/schema_categories.php';
require_once __DIR__ . '/../config/site_settings.php';
require_once __DIR__ . '/../config/user_services.php';
require_once __DIR__ . '/../config/professional_profile.php';
require_once __DIR__ . '/../config/schema_clients.php';

function handlePublic($path, $method, $input) {
    $db = getDB();
    ensureCategorySchema($db);
    ensureSiteSettingsSchema($db);
    ensureUserServicesSchema($db);
    ensureProfessionalProfileSchema($db);
    ensureClientSchema($db);
    $subPath = str_replace('/public', '', $path);
    $professionalId = resolvePublicProfessionalId($db);
    
    if (preg_match('#^/professionals/(\d+)$#', $subPath, $matches) && $method === 'GET') {
        $professional = fetchPublicProfessional($db, (int) $matches[1]);
        if (!$professional) {
            jsonResponse(['error' => 'Profesional no encontrado'], 404);
        }
        jsonResponse($professional);
    }

    if ($subPath === '/professional-profile' && $method === 'GET') {
        if ($professionalId <= 0) {
            jsonResponse(['error' => 'Profesional no encontrado'], 404);
        }
        jsonResponse(fetchPublicProfessional($db, $professionalId));
    }
    
    if ($subPath === '/settings' && $method === 'GET') {
        jsonResponse(getPublicSiteSettings($db));

    } elseif ($subPath === '/categories' && $method === 'GET') {
        if ($professionalId > 0) {
            $stmt = $db->prepare("
                SELECT c.id, c.name, c.description, c.icon, c.color,
                       COUNT(s.id) AS services_count
                FROM service_categories c
                JOIN services s ON s.category_id = c.id AND s.active = 1
                JOIN user_services us ON us.service_id = s.id AND us.user_id = ?
                WHERE c.active = 1
                GROUP BY c.id
                HAVING services_count > 0
                ORDER BY c.sort_order, c.name
            ");
            $stmt->execute([$professionalId]);
        } else {
            $stmt = $db->query("
                SELECT c.id, c.name, c.description, c.icon, c.color,
                       COUNT(s.id) AS services_count
                FROM service_categories c
                LEFT JOIN services s ON s.category_id = c.id AND s.active = 1
                WHERE c.active = 1
                GROUP BY c.id
                HAVING services_count > 0
                ORDER BY c.sort_order, c.name
            ");
        }
        jsonResponse($stmt->fetchAll());

    } elseif ($subPath === '/services' && $method === 'GET') {
        $categoryId = isset($_GET['category_id']) ? (int) $_GET['category_id'] : 0;
        if ($professionalId > 0) {
            if ($categoryId > 0) {
                $stmt = $db->prepare("
                    SELECT s.id, s.name, s.description, s.duration_minutes, s.price, s.category_id,
                           COALESCE(c.color, s.color, '#7d7f3e') AS color
                    FROM services s
                    JOIN user_services us ON us.service_id = s.id AND us.user_id = ?
                    LEFT JOIN service_categories c ON c.id = s.category_id
                    WHERE s.active = 1 AND s.category_id = ?
                    ORDER BY s.name
                ");
                $stmt->execute([$professionalId, $categoryId]);
            } else {
                $stmt = $db->prepare("
                    SELECT s.id, s.name, s.description, s.duration_minutes, s.price, s.category_id,
                           COALESCE(c.color, s.color, '#7d7f3e') AS color
                    FROM services s
                    JOIN user_services us ON us.service_id = s.id AND us.user_id = ?
                    LEFT JOIN service_categories c ON c.id = s.category_id
                    WHERE s.active = 1
                    ORDER BY s.name
                ");
                $stmt->execute([$professionalId]);
            }
        } elseif ($categoryId > 0) {
            $stmt = $db->prepare("
                SELECT s.id, s.name, s.description, s.duration_minutes, s.price, s.category_id,
                       COALESCE(c.color, s.color, '#7d7f3e') AS color
                FROM services s
                LEFT JOIN service_categories c ON c.id = s.category_id
                WHERE s.active = 1 AND s.category_id = ?
                ORDER BY s.name
            ");
            $stmt->execute([$categoryId]);
        } else {
            $stmt = $db->query("
                SELECT s.id, s.name, s.description, s.duration_minutes, s.price, s.category_id,
                       COALESCE(c.color, s.color, '#7d7f3e') AS color
                FROM services s
                LEFT JOIN service_categories c ON c.id = s.category_id
                WHERE s.active = 1
                ORDER BY s.name
            ");
        }
        jsonResponse($stmt->fetchAll());
        
    } elseif ($subPath === '/availability' && $method === 'POST') {
        $date = $input['date'] ?? date('Y-m-d');
        $serviceId = $input['service_id'] ?? null;
        $slotProfessionalId = (int) ($input['professional_id'] ?? $professionalId ?: 0);
        
        $duration = 60;
        if ($serviceId) {
            $stmt = $db->prepare("SELECT duration_minutes FROM services WHERE id = ?");
            $stmt->execute([$serviceId]);
            $service = $stmt->fetch();
            if ($service) $duration = $service['duration_minutes'];
        }
        
        $dayOfWeek = date('w', strtotime($date));
        $stmt = $db->prepare("SELECT * FROM availability WHERE day_of_week = ?");
        $stmt->execute([$dayOfWeek]);
        $avail = $stmt->fetch();
        
        if (!$avail || !$avail['start_time']) {
            jsonResponse(['slots' => []]);
        }
        
        $stmt = $db->prepare("SELECT id FROM blocked_dates WHERE block_date = ?");
        $stmt->execute([$date]);
        if ($stmt->fetch()) {
            jsonResponse(['slots' => []]);
        }
        
        $slots = [];
        $start = strtotime($date . ' ' . $avail['start_time']);
        $end = strtotime($date . ' ' . $avail['end_time']);
        
        while ($start + ($duration * 60) <= $end) {
            $slotTime = date('H:i', $start);
            $slotEnd = date('H:i', $start + ($duration * 60));
            $slotTimeDb = $slotTime . ':00';
            
            $slots[] = [
                'time' => $slotTime,
                'end_time' => $slotEnd,
                'available' => !isAppointmentSlotTaken($db, $date, $slotTimeDb, $slotProfessionalId ?: null),
            ];
            $start += 30 * 60;
        }
        
        jsonResponse(['slots' => $slots]);
        
    } elseif ($subPath === '/form-questions' && $method === 'GET') {
        $stmt = $db->query("SELECT * FROM form_questions WHERE active = 1 ORDER BY sort_order");
        jsonResponse($stmt->fetchAll());
        
    } elseif ($subPath === '/book' && $method === 'POST') {
        $bookProfessionalId = (int) ($input['professional_id'] ?? $professionalId ?: 0);
        $serviceId = (int) ($input['service_id'] ?? 0);

        if ($bookProfessionalId > 0) {
            $professional = fetchPublicProfessional($db, $bookProfessionalId);
            if (!$professional) {
                jsonResponse(['error' => 'Profesional no válido'], 400);
            }
            if ($serviceId && !in_array($serviceId, $professional['service_ids'], true)) {
                jsonResponse(['error' => 'El servicio no está disponible para este profesional'], 400);
            }
        }

        $result = findOrCreateClient($db, [
            'name' => $input['name'] ?? '',
            'email' => $input['email'] ?? '',
            'phone' => $input['phone'] ?? '',
            'notes' => $input['notes'] ?? '',
        ]);
        $client = $result['client'];
        $clientId = (int) $client['id'];
        
        $stmt = $db->prepare("INSERT INTO appointments (service_id, professional_id, client_id, appointment_date, appointment_time, duration_minutes, status, notes) VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?)");
        $durationMins = $input['duration_minutes'] ?? $input['duration'] ?? 60;
        $time = $input['time'] ?? '09:00';
        if (strpos($time, ':') === false || substr_count($time, ':') === 1) {
            if (substr_count($time, ':') === 1) $time .= ':00';
        }
        $stmt->execute([
            $serviceId,
            $bookProfessionalId > 0 ? $bookProfessionalId : null,
            $clientId,
            $input['date'],
            $time,
            $durationMins,
            $input['notes'] ?? '',
        ]);
        $appointmentId = $db->lastInsertId();

        require_once __DIR__ . '/../utils/Mailer.php';
        require_once __DIR__ . '/../utils/GoogleCalendar.php';
        $appointment = fetchAppointmentForEmail((int) $appointmentId, $db);

        $emailStatus = ['client' => ['sent' => false], 'admin' => ['sent' => false], 'professional' => ['sent' => false]];
        $googleStatus = ['synced' => false];
        if ($appointment) {
            $emailStatus = sendBookingEmails($appointment);
            $googleStatus = syncAppointmentToGoogleCalendar($appointment, $db);
        }
        
        jsonResponse([
            'message' => 'Appointment booked successfully',
            'appointment_id' => $appointmentId,
            'client_id' => $clientId,
            'email_sent' => $emailStatus['client']['sent'] ?? false,
            'email_status' => $emailStatus,
            'google_calendar_synced' => $googleStatus['synced'] ?? false,
        ], 201);
        
    } elseif (strpos($subPath, '/availability-month/') === 0 && $method === 'GET') {
        $parts = explode('/', trim($subPath, '/'));
        // /availability-month/2026/6 => ['availability-month', '2026', '6']
        $year = intval($parts[1]);
        $month = intval($parts[2]);
        
        if ($year < 2000 || $year > 2100 || $month < 1 || $month > 12) {
            jsonResponse(['days' => []]);
            return;
        }
        
        $startDate = sprintf('%04d-%02d-01', $year, $month);
        $endDate = date('Y-m-t', strtotime($startDate));
        
        $stmt = $db->query("SELECT day_of_week, start_time, end_time FROM availability WHERE start_time IS NOT NULL");
        $availability = $stmt->fetchAll();
        $availableDays = array_map('intval', array_column($availability, 'day_of_week'));
        
        $stmt = $db->prepare("SELECT block_date FROM blocked_dates WHERE block_date BETWEEN ? AND ?");
        $stmt->execute([$startDate, $endDate]);
        $blockedDates = array_column($stmt->fetchAll(), 'block_date');
        
        $stmt = $db->prepare("SELECT appointment_date, COUNT(*) as count FROM appointments WHERE appointment_date BETWEEN ? AND ? AND status != 'cancelled' GROUP BY appointment_date");
        $stmt->execute([$startDate, $endDate]);
        $bookedDates = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        
        $days = [];
        $current = new DateTime($startDate);
        $end = new DateTime($endDate);
        $today = new DateTime('today');
        
        while ($current <= $end) {
            $dateStr = $current->format('Y-m-d');
            $dayOfWeek = (int)$current->format('w');
            $isPast = $current < $today;
            $isBlocked = in_array($dateStr, $blockedDates);
            $isAvailable = in_array($dayOfWeek, $availableDays) && !$isPast && !$isBlocked;
            
            $days[$dateStr] = [
                'date' => $dateStr,
                'available' => $isAvailable,
                'isPast' => $isPast,
                'booked_count' => $bookedDates[$dateStr] ?? 0
            ];
            $current->modify('+1 day');
        }
        
        jsonResponse(['days' => $days]);
    } elseif (preg_match('#^/available/(\d+)/(\d{4}-\d{2}-\d{2})$#', $subPath, $m) && $method === 'GET') {
        $serviceId = $m[1];
        $date = $m[2];
        $slotProfessionalId = $professionalId;
        
        $duration = 60;
        $stmt = $db->prepare("SELECT duration_minutes FROM services WHERE id = ?");
        $stmt->execute([$serviceId]);
        $service = $stmt->fetch();
        if ($service) $duration = $service['duration_minutes'];
        
        $dayOfWeek = date('w', strtotime($date));
        $stmt = $db->prepare("SELECT * FROM availability WHERE day_of_week = ?");
        $stmt->execute([$dayOfWeek]);
        $avail = $stmt->fetch();
        
        if (!$avail || !$avail['start_time']) {
            jsonResponse(['available' => false, 'slots' => []]);
        }
        
        $stmt = $db->prepare("SELECT id FROM blocked_dates WHERE block_date = ?");
        $stmt->execute([$date]);
        if ($stmt->fetch()) {
            jsonResponse(['available' => false, 'slots' => []]);
        }
        
        $slots = [];
        $start = strtotime($date . ' ' . $avail['start_time']);
        $end = strtotime($date . ' ' . $avail['end_time']);
        
        while ($start + ($duration * 60) <= $end) {
            $slotTime = date('H:i', $start);
            $slotEnd = date('H:i', $start + ($duration * 60));
            $slotTimeDb = $slotTime . ':00';
            
            $slots[] = [
                'time' => $slotTime,
                'end_time' => $slotEnd,
                'available' => !isAppointmentSlotTaken($db, $date, $slotTimeDb, $slotProfessionalId ?: null),
            ];
            $start += 30 * 60;
        }
        
        jsonResponse(['available' => count($slots) > 0, 'slots' => $slots]);
    } else {
        jsonResponse(['error' => 'Not found'], 404);
    }
}
