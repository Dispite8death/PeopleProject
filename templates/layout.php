<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#245b4b">
  <meta name="app-config" content="<?= htmlspecialchars(json_encode($client), ENT_QUOTES, 'UTF-8') ?>">
  <title>ПОКЕМОН — университет вместе</title>
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/css/app.css">
  <script type="module" src="/assets/js/app.js"></script>
</head>
<body>
  <a class="skip-link" href="#main">К содержимому</a>
  <div id="app"><main class="initial-loading" aria-busy="true"><strong>ПОКЕМОН</strong><p>Готовим ваше рабочее пространство…</p></main></div>
  <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
  <dialog id="modal" aria-labelledby="dialog-title"></dialog>
  <noscript>Для демонстрационного интерфейса требуется JavaScript.</noscript>
</body>
</html>
