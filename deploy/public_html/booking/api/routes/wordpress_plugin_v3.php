<?php

function getWordPressPluginDir() {
    $candidates = [
        __DIR__ . '/../wordpress-plugin/tapai-agenda',
        __DIR__ . '/../../../wordpress-plugin/tapai-agenda',
    ];

    foreach ($candidates as $dir) {
        $real = realpath($dir);
        if ($real && is_dir($real)) {
            return $real;
        }
    }

    return null;
}

function downloadWordPressPlugin() {
    if (!class_exists('ZipArchive')) {
        jsonResponse(['error' => 'ZipArchive no está disponible en el servidor'], 500);
    }

    $pluginDir = getWordPressPluginDir();
    if (!$pluginDir) {
        jsonResponse(['error' => 'No se encontró el plugin de WordPress'], 404);
    }

    $zipPath = tempnam(sys_get_temp_dir(), 'tapai-agenda-');
    if ($zipPath === false) {
        jsonResponse(['error' => 'No se pudo preparar la descarga'], 500);
    }

    $zipFile = $zipPath . '.zip';
    rename($zipPath, $zipFile);

    $zip = new ZipArchive();
    if ($zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        @unlink($zipFile);
        jsonResponse(['error' => 'No se pudo crear el archivo ZIP'], 500);
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($pluginDir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );

    foreach ($iterator as $file) {
        if (!$file->isFile()) {
            continue;
        }

        $filePath = $file->getRealPath();
        $relativePath = 'tapai-agenda/' . substr($filePath, strlen($pluginDir) + 1);
        $zip->addFile($filePath, str_replace('\\', '/', $relativePath));
    }

    $zip->close();

    if (!is_file($zipFile) || filesize($zipFile) === 0) {
        @unlink($zipFile);
        jsonResponse(['error' => 'El archivo ZIP quedó vacío'], 500);
    }

    header_remove('Content-Type');
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="tapai-agenda.zip"');
    header('Content-Length: ' . filesize($zipFile));
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');

    readfile($zipFile);
    @unlink($zipFile);
    exit;
}
