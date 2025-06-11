USE cricktrades;

INSERT INTO contests (name, entry_fee, contest_type, start_time, end_time) VALUES
('Daily Trading Challenge', 100, 'daily', NOW(), DATE_ADD(NOW(), INTERVAL 1 DAY)),
('Weekly Stock Battle', 500, 'weekly', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY)),
('Monthly Investment Marathon', 1000, 'weekly', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY)),
('Beginner\'s Luck Contest', 50, 'daily', NOW(), DATE_ADD(NOW(), INTERVAL 1 DAY)),
('Pro Traders Showdown', 2000, 'weekly', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY));
