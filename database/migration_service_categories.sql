-- =============================================
-- Migración: categorías de servicios
-- Base de datos: tapaicentro_calendar
-- Ejecutar en phpMyAdmin (paso a paso)
-- =============================================

SET NAMES utf8mb4;

-- PASO 1 — Tabla de categorías
CREATE TABLE IF NOT EXISTS `service_categories` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- PASO 2 — Columna category_id (SOLO si aún no existe)
-- Si ves error #1060 "Nombre duplicado de columna 'category_id'":
--   → OMITE este paso, la columna ya fue creada por la auto-migración de la API.
--
-- ALTER TABLE `services`
--   ADD COLUMN `category_id` int(11) DEFAULT NULL AFTER `color`,
--   ADD KEY `idx_service_category` (`category_id`);

-- PASO 3 — Categorías iniciales (solo si la tabla está vacía)
INSERT INTO `service_categories` (`name`, `description`, `icon`, `color`, `sort_order`)
SELECT * FROM (
  SELECT 'Terapias Corporales' AS name, 'Masajes, acupuntura y tratamientos físicos' AS description, 'self_improvement' AS icon, '#7d7f3e' AS color, 1 AS sort_order
  UNION ALL
  SELECT 'Energía y Bienestar', 'Reiki, consultas holísticas y sanación', 'spa', '#aaa66a', 2
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM `service_categories` LIMIT 1);

-- PASO 4 — Asignar servicios existentes a categorías
UPDATE `services` SET `category_id` = 1
WHERE `category_id` IS NULL
  AND `name` IN ('Acupuntura', 'Masaje Terapeutico', 'Masaje Terapéutico');

UPDATE `services` SET `category_id` = 2
WHERE `category_id` IS NULL
  AND `name` IN ('Reiki', 'Consultoria Holistica', 'Consultoría Holística');

UPDATE `services` SET `category_id` = 1
WHERE `category_id` IS NULL AND `active` = 1;
