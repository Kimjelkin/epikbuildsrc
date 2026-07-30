<?php
function api_auth($pdo, $action) {
    if ($action === 'signup') return auth_signup($pdo);
    if ($action === 'signin') return auth_signin($pdo);
    if ($action === 'signout') return auth_signout();
    if ($action === 'me') return auth_me($pdo);
    json_out(['ok' => false, 'error' => 'unknown_action']);
}

function auth_signup($pdo) {
    $username = trim(post_var('username'));
    $password = post_var('password');
    $invkey = trim(post_var('invkey'));

    if (!preg_match('/^[A-Za-z0-9_]{3,32}$/', $username)) {
        json_out(['ok' => false, 'error' => 'username_invalid']);
    }
    if (strlen($password) < 4) {
        json_out(['ok' => false, 'error' => 'password_short']);
    }

    $playerCount = (int)$pdo->query('SELECT COUNT(*) FROM players')->fetchColumn();
    $shouldBeAdmin = ($playerCount === 0) ? 1 : 0;

    if ($playerCount > 0) {
        if ($invkey === '') json_out(['ok' => false, 'error' => 'invite_required']);
        $stmt = $pdo->prepare('SELECT id, used_by FROM invite_keys WHERE invkey = ?');
        $stmt->execute([$invkey]);
        $irow = $stmt->fetch();
        if (!$irow) json_out(['ok' => false, 'error' => 'invite_invalid']);
        if ($irow['used_by'] !== null) json_out(['ok' => false, 'error' => 'invite_used']);
    }

    $stmt = $pdo->prepare('SELECT id FROM players WHERE username = ?');
    $stmt->execute([$username]);
    if ($stmt->fetch()) json_out(['ok' => false, 'error' => 'username_taken']);

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('INSERT INTO players (username, password_hash, is_admin) VALUES (?, ?, ?)');
    $stmt->execute([$username, $hash, $shouldBeAdmin]);
    $id = (int)$pdo->lastInsertId();

    if ($playerCount > 0 && isset($irow)) {
        $pdo->prepare('UPDATE invite_keys SET used_by = ?, used_at = CURRENT_TIMESTAMP WHERE id = ?')
            ->execute([$id, $irow['id']]);
    }

    $_SESSION['player_id'] = $id;
    $_SESSION['player_name'] = $username;
    $_SESSION['is_admin'] = $shouldBeAdmin;
    json_out(['ok' => true, 'player' => ['id' => $id, 'username' => $username, 'is_admin' => $shouldBeAdmin]]);
}

function auth_signin($pdo) {
    $username = trim(post_var('username'));
    $password = post_var('password');

    $stmt = $pdo->prepare('SELECT id, username, password_hash, is_admin FROM players WHERE username = ?');
    $stmt->execute([$username]);
    $row = $stmt->fetch();
    if (!$row || !password_verify($password, $row['password_hash'])) {
        json_out(['ok' => false, 'error' => 'invalid_credentials']);
    }

    $isAdmin = (int)$row['is_admin'];
    if ($isAdmin === 0) {
        $adminCount = (int)$pdo->query('SELECT COUNT(*) FROM players WHERE is_admin = 1')->fetchColumn();
        if ($adminCount === 0) {
            $pdo->prepare('UPDATE players SET is_admin = 1 WHERE id = ?')->execute([$row['id']]);
            $isAdmin = 1;
        }
    }

    $_SESSION['player_id'] = (int)$row['id'];
    $_SESSION['player_name'] = $row['username'];
    $_SESSION['is_admin'] = $isAdmin;
    json_out(['ok' => true, 'player' => [
        'id' => (int)$row['id'],
        'username' => $row['username'],
        'is_admin' => $isAdmin
    ]]);
}

function auth_signout() {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    json_out(['ok' => true]);
}

function auth_me($pdo) {
    if (!isset($_SESSION['player_id'])) json_out(['ok' => false]);
    $stmt = $pdo->prepare('SELECT username, is_admin FROM players WHERE id = ?');
    $stmt->execute([$_SESSION['player_id']]);
    $row = $stmt->fetch();
    if (!$row) json_out(['ok' => false]);
    $_SESSION['is_admin'] = (int)$row['is_admin'];
    json_out(['ok' => true, 'player' => [
        'id' => (int)$_SESSION['player_id'],
        'username' => $row['username'],
        'is_admin' => (int)$row['is_admin']
    ]]);
}
