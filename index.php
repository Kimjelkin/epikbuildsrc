<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/api/api_auth.php';
require_once __DIR__ . '/api/api_invite.php';
require_once __DIR__ . '/api/api_games.php';
require_once __DIR__ . '/api/api_users.php';
require_once __DIR__ . '/api/api_multiplayer.php';

$api = isset($_GET['api']) ? $_GET['api'] : (isset($_POST['api']) ? $_POST['api'] : '');
if ($api !== '') {
    $pdo = db();
    $action = isset($_REQUEST['action']) ? $_REQUEST['action'] : '';
    $routes = [
        'auth' => 'api_auth',
        'invite' => 'api_invite',
        'games' => 'api_games',
        'users' => 'api_users',
        'multiplayer' => 'api_multiplayer',
    ];
    if (isset($routes[$api])) {
        $routes[$api]($pdo, $action);
    }
    json_out(['ok' => false, 'error' => 'unknown_api']);
}

db();
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>epikbuild</title>
<link rel="icon" type="image/png" href="favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>
<script src="firebase-config.js"></script>
</head>
<body>
<div id="app"></div>
<script src="app.js"></script>
</body>
</html>
