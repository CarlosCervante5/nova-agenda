<?php
function handleFormQuestions($path, $method, $input) {
    $db = getDB();
    
    if ($path === '/form-questions' && $method === 'GET') {
        $stmt = $db->query("SELECT * FROM form_questions ORDER BY sort_order");
        jsonResponse($stmt->fetchAll());
        
    } elseif ($path === '/form-questions' && $method === 'POST') {
        $stmt = $db->prepare("INSERT INTO form_questions (label, field_type, required, options, sort_order) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([
            $input['label'], $input['field_type'] ?? $input['type'] ?? 'text',
            $input['required'] ?? 0, 
            !empty($input['options']) ? json_encode($input['options']) : null,
            $input['sort_order'] ?? $input['order'] ?? 0
        ]);
        jsonResponse(['id' => $db->lastInsertId(), 'message' => 'Question created'], 201);
        
    } elseif (preg_match('#/form-questions/(\d+)#', $path, $matches) && $method === 'PUT') {
        $stmt = $db->prepare("UPDATE form_questions SET label = ?, field_type = ?, required = ?, options = ?, sort_order = ? WHERE id = ?");
        $stmt->execute([
            $input['label'], $input['field_type'] ?? $input['type'] ?? 'text',
            $input['required'] ?? 0,
            !empty($input['options']) ? json_encode($input['options']) : null,
            $input['sort_order'] ?? $input['order'] ?? 0, $matches[1]
        ]);
        jsonResponse(['message' => 'Question updated']);
        
    } elseif (preg_match('#/form-questions/(\d+)#', $path, $matches) && $method === 'DELETE') {
        $db->prepare("DELETE FROM form_questions WHERE id = ?")->execute([$matches[1]]);
        jsonResponse(['message' => 'Question deleted']);
        
    } elseif ($path === '/form-questions/reorder' && $method === 'POST') {
        $orderedIds = $input['orderedIds'] ?? [];
        $stmt = $db->prepare("UPDATE form_questions SET sort_order = ? WHERE id = ?");
        foreach ($orderedIds as $index => $id) {
            $stmt->execute([$index + 1, $id]);
        }
        jsonResponse(['message' => 'Questions reordered']);
    }
}
