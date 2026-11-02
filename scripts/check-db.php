<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { exit(1); }
require dirname(__DIR__) . '/app/database.php';
try {
    $pdo = database();
    $result = $pdo->query('SELECT VERSION() AS version, DATABASE() AS db, CURRENT_USER() AS account, @@character_set_connection AS charset')->fetch();
    $result['innodb'] = $pdo->query("SELECT SUPPORT FROM information_schema.ENGINES WHERE ENGINE = 'InnoDB'")->fetchColumn();
    $result['tables'] = count($pdo->query('SHOW TABLES')->fetchAll());
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), PHP_EOL;
} catch (Throwable $e) {
    fwrite(STDERR, 'Database check failed. Verify local configuration and logs.' . PHP_EOL);
    exit(1);
}
