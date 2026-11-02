<?php
declare(strict_types=1);
require dirname(__DIR__) . '/app/bootstrap.php';
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
$config = app_config();
$client = ['mode' => $config['mode'], 'apiBase' => $config['apiBase'], 'timezone' => $config['timezone']];
require dirname(__DIR__) . '/templates/layout.php';
