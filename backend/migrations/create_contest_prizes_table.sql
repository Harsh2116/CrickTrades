CREATE TABLE IF NOT EXISTS contest_prizes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    contest_id INT NOT NULL,
    prize_amount DECIMAL(15,2) NOT NULL,
    awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
    UNIQUE KEY user_contest_prize (user_id, contest_id)
);
