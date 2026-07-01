<?php

function ensureAppointmentSchema($db) {
    static $done = false;
    if ($done) {
        return;
    }

    $stmt = $db->query("SHOW COLUMNS FROM appointments LIKE 'status'");
    $column = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($column) {
        $type = strtolower($column['Type'] ?? '');
        if (!str_contains($type, 'no_show')) {
            $db->exec("ALTER TABLE appointments MODIFY COLUMN status ENUM('pending','confirmed','cancelled','completed','no_show') NOT NULL DEFAULT 'pending'");
        }
    }

    foreach ([
        'client_reminder_sent_at' => "DATETIME NULL DEFAULT NULL AFTER status",
        'professional_reminder_sent_at' => "DATETIME NULL DEFAULT NULL AFTER client_reminder_sent_at",
    ] as $columnName => $definition) {
        $check = $db->query("SHOW COLUMNS FROM appointments LIKE '{$columnName}'");
        if (!$check->fetch()) {
            $db->exec("ALTER TABLE appointments ADD COLUMN {$columnName} {$definition}");
        }
    }

    $done = true;
}

function normalizeAppointmentRow(array &$row) {
    if (!empty($row['appointment_date'])) {
        $row['appointment_date'] = substr((string) $row['appointment_date'], 0, 10);
    }
}

function normalizeAppointmentRows(array &$rows) {
    foreach ($rows as &$row) {
        normalizeAppointmentRow($row);
    }
    unset($row);
}

function isValidAppointmentStatus($status) {
    return in_array($status, getActiveAppointmentStatuses(), true);
}
