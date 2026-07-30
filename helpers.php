<?php
function json_out($data) {
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function require_login() {
    if (!isset($_SESSION['player_id'])) {
        json_out(['ok' => false, 'error' => 'not_authenticated']);
    }
}

function require_admin() {
    if (!isset($_SESSION['player_id']) || empty($_SESSION['is_admin'])) {
        json_out(['ok' => false, 'error' => 'admin_required']);
    }
}

function current_player_id() {
    return isset($_SESSION['player_id']) ? (int)$_SESSION['player_id'] : 0;
}

function current_player_name() {
    return isset($_SESSION['player_name']) ? $_SESSION['player_name'] : 'player';
}

function is_admin() {
    return !empty($_SESSION['is_admin']);
}

function post_var($name, $default = '') {
    return isset($_POST[$name]) ? $_POST[$name] : $default;
}

function request_var($name, $default = '') {
    return isset($_REQUEST[$name]) ? $_REQUEST[$name] : $default;
}

function parse_json_body() {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (is_array($data)) {
        $_POST = array_merge($_POST, $data);
    }
}

function generate_invkey() {
    $raw = bin2hex(random_bytes(8));
    return substr($raw, 0, 4) . '-' . substr($raw, 4, 4) . '-' . substr($raw, 8, 4) . '-' . substr($raw, 12, 4);
}
