<?php
function handleClients($path, $method, $input) {
    $db = getDB();
    
    if ($path === '/clients' && $method === 'GET') {
        $stmt = $db->query("SELECT * FROM clients ORDER BY name");
        jsonResponse($stmt->fetchAll());
        
    } elseif ($path === '/clients' && $method === 'POST') {
        $stmt = $db->prepare("INSERT INTO clients (name, email, phone, notes) VALUES (?, ?, ?, ?)");
        $stmt->execute([$input['name'], $input['email'] ?? '', $input['phone'] ?? '', $input['notes'] ?? '']);
        jsonResponse(['id' => $db->lastInsertId(), 'message' => 'Client created'], 201);
        
    } elseif (preg_match('#/clients/(\d+)#', $path, $matches) && $method === 'PUT') {
        $stmt = $db->prepare("UPDATE clients SET name = ?, email = ?, phone = ?, notes = ? WHERE id = ?");
        $stmt->execute([$input['name'], $input['email'] ?? '', $input['phone'] ?? '', $input['notes'] ?? '', $matches[1]]);
        jsonResponse(['message' => 'Client updated']);
        
    } elseif (preg_match('#/clients/(\d+)#', $path, $matches) && $method === 'DELETE') {
        $db->prepare("DELETE FROM clients WHERE id = ?")->execute([$matches[1]]);
        jsonResponse(['message' => 'Client deleted']);
    }
}
