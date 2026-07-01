<?php
require_once __DIR__ . '/../config/schema_categories.php';

function handleCategories($path, $method, $input) {
    $db = getDB();
    ensureCategorySchema($db);

    if ($path === '/categories' && $method === 'GET') {
        $stmt = $db->query("
            SELECT c.*, COUNT(s.id) AS services_count
            FROM service_categories c
            LEFT JOIN services s ON s.category_id = c.id
            GROUP BY c.id
            ORDER BY c.sort_order, c.name
        ");
        jsonResponse($stmt->fetchAll());
    } elseif ($path === '/categories' && $method === 'POST') {
        $stmt = $db->prepare("INSERT INTO service_categories (name, description, icon, color, sort_order, active) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $input['name'],
            $input['description'] ?? '',
            $input['icon'] ?? 'spa',
            $input['color'] ?? '#7d7f3e',
            $input['sort_order'] ?? 0,
            $input['active'] ?? 1,
        ]);
        jsonResponse(['id' => $db->lastInsertId(), 'message' => 'Category created'], 201);
    } elseif (preg_match('#^/categories/(\d+)$#', $path, $matches) && $method === 'PUT') {
        $categoryId = (int) $matches[1];
        $color = $input['color'] ?? '#7d7f3e';
        $stmt = $db->prepare("UPDATE service_categories SET name = ?, description = ?, icon = ?, color = ?, sort_order = ?, active = ? WHERE id = ?");
        $stmt->execute([
            $input['name'],
            $input['description'] ?? '',
            $input['icon'] ?? 'spa',
            $color,
            $input['sort_order'] ?? 0,
            $input['active'] ?? 1,
            $categoryId,
        ]);
        syncServiceColorsForCategory($db, $categoryId, $color);
        jsonResponse(['message' => 'Category updated']);
    } elseif (preg_match('#^/categories/(\d+)$#', $path, $matches) && $method === 'DELETE') {
        $stmt = $db->prepare("UPDATE services SET category_id = NULL WHERE category_id = ?");
        $stmt->execute([$matches[1]]);
        $db->prepare("DELETE FROM service_categories WHERE id = ?")->execute([$matches[1]]);
        jsonResponse(['message' => 'Category deleted']);
    } else {
        jsonResponse(['error' => 'Not found'], 404);
    }
}
