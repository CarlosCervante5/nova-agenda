<?php

function getApiBasePath() {
    if (defined('API_BASE_PATH') && API_BASE_PATH !== '') {
        return rtrim(API_BASE_PATH, '/');
    }

    $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
    if ($scriptName !== '' && str_contains($scriptName, 'index_v3.php')) {
        $dir = rtrim(str_replace('\\', '/', dirname($scriptName)), '/');
        return $dir !== '' ? $dir : '/booking/api';
    }

    $requestUri = $_SERVER['REQUEST_URI'] ?? '';
    if (preg_match('#(/booking/api)(?:/|$)#', $requestUri, $matches)) {
        return $matches[1];
    }

    return '/booking/api';
}

function getAdminDistBasePath() {
    $apiBase = getApiBasePath();
    if (str_ends_with($apiBase, '/api')) {
        return substr($apiBase, 0, -4) . '/admin-dist';
    }

    return '/booking/admin-dist';
}

function getAbsoluteUrl($path) {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';

    return $scheme . '://' . $host . $path;
}
