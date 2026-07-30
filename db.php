<?php
function db() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
    $opts = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];
    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $opts);
    } catch (PDOException $e) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['ok' => false, 'error' => 'db_connection_failed']);
        exit;
    }
    db_init_tables($pdo);
    return $pdo;
}

function db_init_tables($pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(32) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_admin TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS games (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_id INT NOT NULL,
        title VARCHAR(120) NOT NULL,
        description TEXT,
        blocks LONGTEXT,
        script LONGTEXT,
        pushback TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX(owner_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS positions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        game_id INT NOT NULL,
        player_id INT NOT NULL,
        player_name VARCHAR(32) NOT NULL,
        x DOUBLE NOT NULL,
        y DOUBLE NOT NULL,
        face INT NOT NULL DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX(game_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        game_id INT NOT NULL,
        player_name VARCHAR(32) NOT NULL,
        text VARCHAR(300) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX(game_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS invite_keys (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invkey VARCHAR(40) UNIQUE NOT NULL,
        created_by INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        used_by INT DEFAULT NULL,
        used_at DATETIME DEFAULT NULL,
        INDEX(invkey)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $migrations = [
        "ALTER TABLE games ADD COLUMN script LONGTEXT",
        "ALTER TABLE games MODIFY COLUMN blocks LONGTEXT",
        "ALTER TABLE games ADD COLUMN pushback TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE positions ADD COLUMN client_key VARCHAR(40)",
        "ALTER TABLE positions ADD COLUMN skin TEXT",
        "ALTER TABLE players ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE invite_keys CHANGE COLUMN invite_key invkey VARCHAR(40) UNIQUE NOT NULL",
    ];
    foreach ($migrations as $sql) {
        try { $pdo->exec($sql); } catch (Exception $e) {}
    }
}
