<?php
function handleAppointments($path, $method, $input) {
    $db = getDB();
    
    if ($path === '/appointments' && $method === 'GET') {
        $where = [];
        $params = [];
        
        if (!empty($_GET['dateFrom'])) { $where[] = 'a.appointment_date >= ?'; $params[] = $_GET['dateFrom']; }
        if (!empty($_GET['dateTo'])) { $where[] = 'a.appointment_date <= ?'; $params[] = $_GET['dateTo']; }
        if (!empty($_GET['date'])) { $where[] = 'a.appointment_date = ?'; $params[] = $_GET['date']; }
        if (!empty($_GET['status'])) { $where[] = 'a.status = ?'; $params[] = $_GET['status']; }
        
        $sql = "SELECT a.*, s.name as service_name, s.color as service_color, 
                c.name as client_name, c.email as client_email, c.phone as client_phone 
                FROM appointments a 
                LEFT JOIN services s ON a.service_id = s.id 
                LEFT JOIN clients c ON a.client_id = c.id";
        if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
        $sql .= ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';
        
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll());
        
    } elseif ($path === '/appointments/stats' && $method === 'GET') {
        $today = date('Y-m-d');
        $weekStart = date('Y-m-d', strtotime('monday this week'));
        $weekEnd = date('Y-m-d', strtotime('sunday this week'));
        
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM appointments WHERE appointment_date = ? AND status != 'cancelled'");
        $stmt->execute([$today]);
        $todayCount = $stmt->fetch()['count'];
        
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM appointments WHERE appointment_date BETWEEN ? AND ? AND status != 'cancelled'");
        $stmt->execute([$weekStart, $weekEnd]);
        $weekCount = $stmt->fetch()['count'];
        
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'pending'");
        $stmt->execute();
        $pendingCount = $stmt->fetch()['count'];
        
        $stmt = $db->query("SELECT COUNT(*) as count FROM clients");
        $totalClients = $stmt->fetch()['count'];
        
        jsonResponse([
            'today' => $todayCount,
            'thisWeek' => $weekCount,
            'pending' => $pendingCount,
            'totalClients' => $totalClients
        ]);
        
    } elseif ($path === '/appointments' && $method === 'POST') {
        $stmt = $db->prepare("INSERT INTO appointments (service_id, client_id, appointment_date, appointment_time, duration_minutes, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $input['service_id'], $input['client_id'], 
            $input['appointment_date'] ?? $input['date'], 
            $input['appointment_time'] ?? $input['time'],
            $input['duration_minutes'] ?? $input['duration'] ?? 60, 
            $input['status'] ?? 'pending', 
            $input['notes'] ?? ''
        ]);
        jsonResponse(['id' => $db->lastInsertId(), 'message' => 'Appointment created'], 201);
        
    } elseif (preg_match('#/appointments/(\d+)#', $path, $matches) && $method === 'PUT') {
        $id = $matches[1];
        $fields = [];
        $values = [];
        
        $map = [
            'service_id' => 'service_id', 'client_id' => 'client_id',
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
        jsonResponse(['message' => 'Appointment updated']);
        
    } elseif (preg_match('#/appointments/(\d+)#', $path, $matches) && $method === 'DELETE') {
        $db->prepare("DELETE FROM appointments WHERE id = ?")->execute([$matches[1]]);
        jsonResponse(['message' => 'Appointment deleted']);
    }
}
