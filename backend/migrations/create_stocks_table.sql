-- Migration to create stocks table
CREATE TABLE IF NOT EXISTS stocks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stock_symbol VARCHAR(20) NOT NULL UNIQUE,
    stock_name VARCHAR(255) NOT NULL
);
