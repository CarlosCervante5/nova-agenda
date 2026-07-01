-- =============================================
-- Booking System - Database Schema & Seed Data
-- Database: tapaicentro_calendar
-- =============================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Users table
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(100) DEFAULT NULL,
  `role` enum('admin','profesional') DEFAULT 'profesional',
  `active` tinyint(1) DEFAULT 1,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Service categories
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

-- Services table
CREATE TABLE IF NOT EXISTS `services` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text,
  `duration_minutes` int(11) NOT NULL DEFAULT 60,
  `price` decimal(10,2) DEFAULT 0.00,
  `color` varchar(7) DEFAULT '#4CAF50',
  `category_id` int(11) DEFAULT NULL,
  `active` tinyint(1) DEFAULT 1,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Clients table
CREATE TABLE IF NOT EXISTS `clients` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `notes` text,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Appointments table
CREATE TABLE IF NOT EXISTS `appointments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  `appointment_date` date NOT NULL,
  `appointment_time` time NOT NULL,
  `duration_minutes` int(11) NOT NULL,
  `status` enum('pending','confirmed','cancelled','completed') DEFAULT 'pending',
  `notes` text,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `client_id` (`client_id`),
  KEY `service_id` (`service_id`),
  CONSTRAINT `appointments_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `appointments_ibfk_2` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Availability table
CREATE TABLE IF NOT EXISTS `availability` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `day_of_week` tinyint(4) NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_day` (`day_of_week`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Blocked dates table
CREATE TABLE IF NOT EXISTS `blocked_dates` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `block_date` date NOT NULL,
  `block_time_start` time DEFAULT NULL,
  `block_time_end` time DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_block` (`block_date`, `block_time_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Form questions table
CREATE TABLE IF NOT EXISTS `form_questions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `label` varchar(255) NOT NULL,
  `field_type` enum('text','email','phone','textarea','select','number','date') NOT NULL DEFAULT 'text',
  `required` tinyint(1) DEFAULT 0,
  `options` json DEFAULT NULL,
  `sort_order` int(11) DEFAULT 0,
  `active` tinyint(1) DEFAULT 1,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Appointment answers table (for custom form fields)
CREATE TABLE IF NOT EXISTS `appointment_answers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `appointment_id` int(11) NOT NULL,
  `question_id` int(11) NOT NULL,
  `answer` text,
  PRIMARY KEY (`id`),
  KEY `appointment_id` (`appointment_id`),
  KEY `question_id` (`question_id`),
  CONSTRAINT `appointment_answers_ibfk_1` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `appointment_answers_ibfk_2` FOREIGN KEY (`question_id`) REFERENCES `form_questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================
-- SEED DATA
-- =============================================

-- Default admin user (password: admin123)
INSERT INTO `users` (`username`, `email`, `password_hash`, `full_name`, `role`) VALUES
('admin', 'admin@tapaicentro.com', '$2y$12$whz904UDLgUZcEapAxbzKO8nadQPtWw/3WG58JKlGB7rs7TW04gQ6', 'Administrador', 'admin');

-- Default profesional user (password: profesional123)
INSERT INTO `users` (`username`, `email`, `password_hash`, `full_name`, `role`) VALUES
('profesional', 'profesional@tapaicentro.com', '$2y$12$.5YzYW4zZt1uU6KLQjZEA.HsCg.ohlmjD/1lDmqTMAxdZtM2UJhB6', 'Profesional Tapai', 'profesional');

-- Default categories
INSERT INTO `service_categories` (`name`, `description`, `icon`, `color`, `sort_order`) VALUES
('Terapias Corporales', 'Masajes, acupuntura y tratamientos físicos', 'self_improvement', '#7d7f3e', 1),
('Energía y Bienestar', 'Reiki, consultas holísticas y sanación', 'spa', '#aaa66a', 2);

-- Default services
INSERT INTO `services` (`name`, `description`, `duration_minutes`, `price`, `color`, `category_id`) VALUES
('Acupuntura', 'Tratamiento de acupuntura tradicional', 60, 50.00, '#4CAF50', 1),
('Reiki', 'Sesion de energia Reiki', 45, 40.00, '#2196F3', 2),
('Masaje Terapeutico', 'Masaje relajante y terapeutico', 90, 65.00, '#FF9800', 1),
('Consultoria Holistica', 'Sesion de consulta integral', 60, 55.00, '#9C27B0', 2);

-- Default availability (Mon-Fri 9-18, Sat 9-14)
INSERT INTO `availability` (`day_of_week`, `start_time`, `end_time`) VALUES
(1, '09:00:00', '18:00:00'),
(2, '09:00:00', '18:00:00'),
(3, '09:00:00', '18:00:00'),
(4, '09:00:00', '18:00:00'),
(5, '09:00:00', '18:00:00'),
(6, '09:00:00', '14:00:00');

-- Default form questions
INSERT INTO `form_questions` (`label`, `field_type`, `required`, `sort_order`) VALUES
('Nombre completo', 'text', 1, 1),
('Email', 'email', 1, 2),
('Telefono', 'phone', 0, 3),
('Notas adicionales', 'textarea', 0, 4);
