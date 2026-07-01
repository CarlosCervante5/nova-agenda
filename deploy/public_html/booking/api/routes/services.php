<?php
function handleServices($path, $method, $input) {
    $db = getDB();
    
    if ($path === '/services' && $method === 'GET') {
        $stmt = $db->query("SELECT * FROM services ORDER BY name");
        jsonResponse($stmt->fetchAll());
        
    } elseif ($path === '/services' && $method === 'POST') {
        $stmt = $db->prepare("INSERT INTO services (name, description, duration_minutes, price, color, active) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $input['name'], $input['description'] ?? '', 
            $input['duration_minutes'] ?? $input['duration'] ?? 60,
            $input['price'] ?? 0, $input['color'] ?? '#4CAF50', $input['active'] ?? 1
        ]);
        jsonResponse(['id' => $db->lastInsertId(), 'message' => 'Service created'], 201);
        
    } elseif (preg_match('#/services/(\d+)#', $path, $matches) && $method === 'PUT') {
        $stmt = $db->prepare("UPDATE services SET name = ?, description = ?, duration_minutes = ?, price = ?, color = ?, active = ? WHERE id = ?");
        $stmt->execute([
            $input['name'], $input['description'] ?? '', 
            $input['duration_minutes'] ?? $input['duration'] ?? 60,
            $input['price'] ?? 0, $input['color'] ?? '#4CAF50', $input['active'] ?? 1, $matches[1]
        ]);
        jsonResponse(['message' => 'Service updated']);
        
    } elseif (preg_match('#/services/(\d+)#', $path, $matches) && $method === 'DELETE') {
        $db->prepare("DELETE FROM services WHERE id = ?")->execute([$matches[1]]);
        jsonResponse(['message' => 'Service deleted']);
    }
}
