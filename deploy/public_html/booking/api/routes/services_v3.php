<?php
require_once __DIR__ . '/../config/schema_categories.php';
require_once __DIR__ . '/../config/user_services.php';

function handleServices($path, $method, $input, $authUser = null) {
    $db = getDB();
    ensureCategorySchema($db);

    if ($path === '/services' && $method === 'GET') {
        $sql = "
            SELECT s.id, s.name, s.description, s.duration_minutes, s.price, s.category_id, s.active,
                   c.name AS category_name,
                   COALESCE(c.color, s.color, '#7d7f3e') AS color
            FROM services s
            LEFT JOIN service_categories c ON c.id = s.category_id
        ";
        $params = [];

        if ($authUser && !isAdmin($authUser)) {
            $serviceIds = getUserServiceIds($db, (int) ($authUser['userId'] ?? 0));
            if (!$serviceIds) {
                jsonResponse([]);
            }
            $placeholders = implode(',', array_fill(0, count($serviceIds), '?'));
            $sql .= " WHERE s.id IN ($placeholders)";
            $params = $serviceIds;
        }

        $sql .= " ORDER BY c.sort_order, s.name";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll());
    } elseif ($path === '/services' && $method === 'POST') {
        $categoryId = !empty($input['category_id']) ? (int) $input['category_id'] : null;
        if (!$categoryId) {
            jsonResponse(['error' => 'La categoría es obligatoria'], 400);
        }

        $color = resolveServiceColor($db, $categoryId);
        $stmt = $db->prepare("INSERT INTO services (name, description, duration_minutes, price, color, category_id, active) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $input['name'],
            $input['description'] ?? '',
            $input['duration_minutes'] ?? $input['duration'] ?? 60,
            $input['price'] ?? 0,
            $color,
            $categoryId,
            $input['active'] ?? 1,
        ]);
        jsonResponse(['id' => $db->lastInsertId(), 'message' => 'Service created'], 201);
    } elseif (preg_match('#^/services/(\d+)$#', $path, $matches) && $method === 'PUT') {
        $categoryId = !empty($input['category_id']) ? (int) $input['category_id'] : null;
        if (!$categoryId) {
            jsonResponse(['error' => 'La categoría es obligatoria'], 400);
        }

        $color = resolveServiceColor($db, $categoryId);
        $stmt = $db->prepare("UPDATE services SET name = ?, description = ?, duration_minutes = ?, price = ?, color = ?, category_id = ?, active = ? WHERE id = ?");
        $stmt->execute([
            $input['name'],
            $input['description'] ?? '',
            $input['duration_minutes'] ?? $input['duration'] ?? 60,
            $input['price'] ?? 0,
            $color,
            $categoryId,
            $input['active'] ?? 1,
            $matches[1],
        ]);
        jsonResponse(['message' => 'Service updated']);
    } elseif (preg_match('#^/services/(\d+)$#', $path, $matches) && $method === 'DELETE') {
        $db->prepare("DELETE FROM services WHERE id = ?")->execute([$matches[1]]);
        jsonResponse(['message' => 'Service deleted']);
    } else {
        jsonResponse(['error' => 'Not found'], 404);
    }
}
