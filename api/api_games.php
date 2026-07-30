<?php
function games_parse_blocks($raw) {
    if ($raw === null || $raw === '') return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function api_games($pdo, $action) {
    if ($action === 'list') return games_list($pdo);
    if ($action === 'get') return games_get($pdo);
    if ($action === 'create') return games_create($pdo);
    if ($action === 'update') return games_update($pdo);
    if ($action === 'delete') return games_delete($pdo);
    if ($action === 'admin_delete') return games_admin_delete($pdo);
    json_out(['ok' => false, 'error' => 'unknown_action']);
}

function games_list($pdo) {
    try {
        $stmt = $pdo->query(
            'SELECT g.id, g.owner_id, g.title, g.description, g.blocks, g.script, g.pushback, g.updated_at, p.username AS owner_name
             FROM games g LEFT JOIN players p ON p.id = g.owner_id
             ORDER BY g.updated_at DESC'
        );
    } catch (Exception $e) {
        $pdo->exec("ALTER TABLE games ADD COLUMN pushback TINYINT(1) NOT NULL DEFAULT 0");
        $stmt = $pdo->query(
            'SELECT g.id, g.owner_id, g.title, g.description, g.blocks, g.script, g.pushback, g.updated_at, p.username AS owner_name
             FROM games g LEFT JOIN players p ON p.id = g.owner_id
             ORDER BY g.updated_at DESC'
        );
    }
    $games = [];
    foreach ($stmt->fetchAll() as $row) {
        $games[] = game_row_to_array($row);
    }
    json_out(['ok' => true, 'games' => $games]);
}

function games_get($pdo) {
    $id = (int)request_var('id', '0');
    try {
        $stmt = $pdo->prepare(
            'SELECT g.id, g.owner_id, g.title, g.description, g.blocks, g.script, g.pushback, g.updated_at, p.username AS owner_name
             FROM games g LEFT JOIN players p ON p.id = g.owner_id
             WHERE g.id = ?'
        );
        $stmt->execute([$id]);
    } catch (Exception $e) {
        $pdo->exec("ALTER TABLE games ADD COLUMN pushback TINYINT(1) NOT NULL DEFAULT 0");
        $stmt = $pdo->prepare(
            'SELECT g.id, g.owner_id, g.title, g.description, g.blocks, g.script, g.pushback, g.updated_at, p.username AS owner_name
             FROM games g LEFT JOIN players p ON p.id = g.owner_id
             WHERE g.id = ?'
        );
        $stmt->execute([$id]);
    }
    $row = $stmt->fetch();
    if (!$row) json_out(['ok' => false, 'error' => 'not_found']);
    json_out(['ok' => true, 'game' => game_row_to_array($row)]);
}

function games_create($pdo) {
    require_login();
    parse_json_body();

    $title = trim(post_var('title'));
    $description = trim(post_var('description'));
    if ($title === '' || strlen($title) > MAX_TITLE_LEN) json_out(['ok' => false, 'error' => 'title_invalid']);
    if (strlen($description) > MAX_DESC_LEN) json_out(['ok' => false, 'error' => 'description_invalid']);

    $blocks = games_parse_blocks(post_var('blocks', '[]'));
    $script = post_var('script', '');
    $pushback = (int)post_var('pushback', '0');

    $stmt = $pdo->prepare('INSERT INTO games (owner_id, title, description, blocks, script, pushback) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute([current_player_id(), $title, $description, json_encode($blocks), $script, $pushback]);
    $id = (int)$pdo->lastInsertId();

    json_out(['ok' => true, 'game' => [
        'id' => $id,
        'owner_id' => current_player_id(),
        'title' => $title,
        'description' => $description,
        'blocks' => $blocks,
        'script' => $script,
        'pushback' => $pushback,
        'owner_name' => current_player_name(),
        'updated_at' => date('Y-m-d H:i:s'),
    ]]);
}

function games_update($pdo) {
    require_login();
    parse_json_body();

    $id = (int)post_var('id', '0');
    $stmt = $pdo->prepare('SELECT owner_id FROM games WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) json_out(['ok' => false, 'error' => 'not_found']);
    if ((int)$row['owner_id'] !== current_player_id()) {
        http_response_code(403);
        json_out(['ok' => false, 'error' => 'forbidden']);
    }

    $title = trim(post_var('title'));
    $description = trim(post_var('description'));
    if ($title === '' || strlen($title) > MAX_TITLE_LEN) json_out(['ok' => false, 'error' => 'title_invalid']);
    if (strlen($description) > MAX_DESC_LEN) json_out(['ok' => false, 'error' => 'description_invalid']);

    $blocks = games_parse_blocks(post_var('blocks', '[]'));
    $script = post_var('script', '');
    $pushback = (int)post_var('pushback', '0');

    $stmt = $pdo->prepare('UPDATE games SET title = ?, description = ?, blocks = ?, script = ?, pushback = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    $stmt->execute([$title, $description, json_encode($blocks), $script, $pushback, $id]);
    json_out(['ok' => true]);
}

function games_delete($pdo) {
    require_login();
    $id = (int)post_var('id', '0');
    $stmt = $pdo->prepare('SELECT owner_id FROM games WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) json_out(['ok' => false, 'error' => 'not_found']);
    if ((int)$row['owner_id'] !== current_player_id()) {
        http_response_code(403);
        json_out(['ok' => false, 'error' => 'forbidden']);
    }
    $pdo->prepare('DELETE FROM games WHERE id = ?')->execute([$id]);
    json_out(['ok' => true]);
}

function games_admin_delete($pdo) {
    require_admin();
    parse_json_body();
    
    $id = (int)post_var('id', '0');
    if ($id <= 0) {
        json_out(['ok' => false, 'error' => 'invalid_id']);
    }
    
    $stmt = $pdo->prepare('SELECT id, owner_id, title FROM games WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        json_out(['ok' => false, 'error' => 'not_found']);
    }
    
    $pdo->prepare('DELETE FROM games WHERE id = ?')->execute([$id]);
    
    json_out(['ok' => true, 'message' => 'Game deleted successfully']);
}

function game_row_to_array($row) {
    return [
        'id' => (int)$row['id'],
        'owner_id' => (int)$row['owner_id'],
        'title' => $row['title'],
        'description' => $row['description'] ? $row['description'] : '',
        'blocks' => games_parse_blocks($row['blocks']),
        'script' => $row['script'] ? $row['script'] : '',
        'pushback' => isset($row['pushback']) ? (int)$row['pushback'] : 0,
        'owner_name' => $row['owner_name'] ? $row['owner_name'] : '',
        'updated_at' => $row['updated_at'],
    ];
}
