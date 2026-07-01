<?php

function ensureCategorySchema($db) {
    static $ensured = false;
    if ($ensured) {
        return;
    }

    $db->exec("CREATE TABLE IF NOT EXISTS `service_categories` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `name` varchar(100) NOT NULL,
        `description` text,
        `icon` varchar(50) DEFAULT 'spa',
        `color` varchar(7) DEFAULT '#7d7f3e',
        `sort_order` int(11) DEFAULT 0,
        `active` tinyint(1) DEFAULT 1,
        `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
        `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $col = $db->query("SHOW COLUMNS FROM services LIKE 'category_id'")->fetch();
    if (!$col) {
        $db->exec("ALTER TABLE services ADD COLUMN category_id int(11) DEFAULT NULL AFTER color, ADD KEY idx_service_category (category_id)");
    }

    $count = (int) $db->query("SELECT COUNT(*) FROM service_categories")->fetchColumn();
    if ($count === 0) {
        $db->exec("INSERT INTO service_categories (name, description, icon, color, sort_order) VALUES
            ('Terapias Corporales', 'Masajes, acupuntura y tratamientos físicos', 'self_improvement', '#7d7f3e', 1),
            ('Energía y Bienestar', 'Reiki, consultas holísticas y sanación', 'spa', '#aaa66a', 2)");

        $db->exec("UPDATE services SET category_id = 1 WHERE name IN ('Acupuntura', 'Masaje Terapeutico', 'Masaje Terapéutico')");
        $db->exec("UPDATE services SET category_id = 2 WHERE name IN ('Reiki', 'Consultoria Holistica', 'Consultoría Holística')");
        $db->exec("UPDATE services SET category_id = 1 WHERE category_id IS NULL");
    }

    $orphans = (int) $db->query("SELECT COUNT(*) FROM services WHERE category_id IS NULL AND active = 1")->fetchColumn();
    if ($orphans > 0) {
        $firstCat = $db->query("SELECT id FROM service_categories ORDER BY sort_order, id LIMIT 1")->fetchColumn();
        if ($firstCat) {
            $stmt = $db->prepare("UPDATE services SET category_id = ? WHERE category_id IS NULL AND active = 1");
            $stmt->execute([$firstCat]);
        }
    }

    syncAllServiceColorsFromCategories($db);

    $ensured = true;
}

function defaultServiceColor() {
    return '#7d7f3e';
}

function resolveServiceColor($db, $categoryId) {
    if (!$categoryId) {
        return defaultServiceColor();
    }

    $stmt = $db->prepare("SELECT color FROM service_categories WHERE id = ?");
    $stmt->execute([(int) $categoryId]);
    $color = $stmt->fetchColumn();

    return $color ?: defaultServiceColor();
}

function syncServiceColorsForCategory($db, $categoryId, $color = null) {
    if (!$categoryId) {
        return;
    }

    if ($color === null) {
        $color = resolveServiceColor($db, $categoryId);
    }

    $stmt = $db->prepare("UPDATE services SET color = ? WHERE category_id = ?");
    $stmt->execute([$color, (int) $categoryId]);
}

function syncAllServiceColorsFromCategories($db) {
    $db->exec("
        UPDATE services s
        INNER JOIN service_categories c ON c.id = s.category_id
        SET s.color = c.color
        WHERE s.category_id IS NOT NULL
    ");
}
