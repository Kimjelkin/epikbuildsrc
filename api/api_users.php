<?php
function api_users($pdo, $action) {
    if ($action !== 'list') json_out(['ok' => false, 'error' => 'unknown_action']);
    $stmt = $pdo->query('SELECT id, username, created_at FROM players ORDER BY created_at DESC LIMIT 200');
    $users = [];
    foreach ($stmt->fetchAll() as $row) {
        $users[] = [
            'id' => (int)$row['id'],
            'username' => $row['username'],
            'created_at' => $row['created_at']
        ];
    }
    json_out(['ok' => true, 'users' => $users]);
}
