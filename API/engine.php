<?php
$method = $_SERVER['REQUEST_METHOD'];
$uri = $_SERVER['REQUEST_URI'];
$path = parse_url($uri, PHP_URL_PATH);
$currentV = 1;

$knownTypes = [
  'workspace',
  'requests',
  'group-approvals',
  'invitations',
  'admin'
];
if (!is_string($path)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => [
        'code' => 'BAD_REQUEST',
        'message' => 'Некорректный путь запроса'
    ]
    ]);
    exit;
}


function CheckURI($splice): bool
{
    return ($splice[1] ?? null) === 'api';
}

function CheckV($splice, $currentV): bool
{
    return ($splice[2] ?? null) === ('v' . $currentV);
}

function CheckType($splice, $types): bool
{
    return in_array($splice[3] ?? null, $types, true);
}

$splice_path = explode('/', $path);

if (CheckURI($splice_path) && CheckV($splice_path, $currentV) && CheckType($splice_path, $knownTypes)) {
    switch ($splice_path[3]):
        case 'workspace':
} else {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => [
        'code' => 'NOT_FOUND',
        'message' => 'Маршрут не найден'
    ]
    ]);
}