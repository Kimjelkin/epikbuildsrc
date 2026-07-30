<?php
define('DB_HOST', 'YOURHOST');
define('DB_NAME', 'YOURNAME');
define('DB_USER', 'YOURUSER');
define('DB_PASS', 'YOURPASS');
define('DB_CHARSET', 'YOURCHARSET');
define('MAX_TITLE_LEN', 50);
define('MAX_DESC_LEN', 50);
define('STALE_SECONDS', 8);
define('MAX_CHAT_LEN', 200);

function init_session() {
    if (session_status() !== PHP_SESSION_NONE) return;
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    $sessDir = __DIR__ . '/sessions';
    if (!is_dir($sessDir)) { @mkdir($sessDir, 0700, true); }
    if (is_dir($sessDir) && is_writable($sessDir)) {
        session_save_path($sessDir);
    }
    ini_set('session.gc_maxlifetime', 86400 * 30);
    ini_set('session.cookie_lifetime', 86400 * 30);
    session_set_cookie_params([
        'lifetime' => 86400 * 30,
        'path' => '/',
        'domain' => '',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

init_session();
