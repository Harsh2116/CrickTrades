USE cricktrades;

INSERT INTO users (full_name, username, password_hash, is_admin)
VALUES ('Admin User', 'Harsh_9509941946@12', '$2b$10$o3YXpN0w0q18eVkPS8wRpu5tt9ZVx6IFt5kxP7Az3ym.cbtIieKiu', TRUE)
ON DUPLICATE KEY UPDATE
password_hash = VALUES(password_hash),
is_admin = VALUES(is_admin);
