<?php
declare(strict_types=1);

function app_config(): array
{
    static $config;
    if ($config === null) {
        $path = dirname(__DIR__) . '/config/local.json';
        if (!is_file($path)) {
            $path = dirname(__DIR__) . '/config/example.json';
        }
        $config = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    }
    return $config;
}

date_default_timezone_set('Asia/Magadan');
