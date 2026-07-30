<?php
function api_invite($pdo, $action) {
    require_admin();
    if ($action === 'list') return invite_list($pdo);
    if ($action === 'generate') return invite_generate($pdo);
    if ($action === 'delete') return invite_delete($pdo);
    json_out(['ok' => false, 'error' => 'unknown_action']);
}

function invite_list($pdo) {
    $stmt = $pdo->prepare(
        'SELECT k.id, k.invkey, k.created_at, k.used_by, k.used_at, p.username AS used_name
         FROM invite_keys k
         LEFT JOIN players p ON p.id = k.used_by
         ORDER BY k.id DESC LIMIT 500'
    );
    $stmt->execute();
    $keys = [];
    foreach ($stmt->fetchAll() as $row) {
        $keys[] = [
            'id' => (int)$row['id'],
            'invkey' => $row['invkey'],
            'created_at' => $row['created_at'],
            'used' => $row['used_by'] !== null,
            'used_by' => $row['used_name'],
            'used_at' => $row['used_at']
        ];
    }
    json_out(['ok' => true, 'keys' => $keys]);
}

function invite_generate($pdo) {
    $count = max(1, min(20, (int)post_var('count', '1')));
    $created = [];
    $stmt = $pdo->prepare('INSERT INTO invite_keys (invkey, created_by) VALUES (?, ?)');
    for ($i = 0; $i < $count; $i++) {
        $invkey = generate_invkey();
        try {
            $stmt->execute([$invkey, current_player_id()]);
            $created[] = $invkey;
        } catch (Exception $e) {}
    }
    json_out(['ok' => true, 'keys' => $created]);
}

function invite_delete($pdo) {
    $id = (int)post_var('id', '0');
    $pdo->prepare('DELETE FROM invite_keys WHERE id = ? AND used_by IS NULL')->execute([$id]);
    json_out(['ok' => true]);
}
