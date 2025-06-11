-- MySQL Database Schema for CrickTrades

CREATE DATABASE IF NOT EXISTS cricktrades;
USE cricktrades;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    referral_code VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallets table
CREATE TABLE IF NOT EXISTS wallets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    main_balance DECIMAL(15,2) DEFAULT 0,
    withdraw_balance DECIMAL(15,2) DEFAULT 0,
    referral_bonus DECIMAL(15,2) DEFAULT 0,
    stock_buying_balance DECIMAL(15,2) DEFAULT 10000,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Portfolio table
CREATE TABLE IF NOT EXISTS portfolios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    stock_symbol VARCHAR(20) NOT NULL,
    stock_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    purchase_price DECIMAL(15,2) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY user_stock (user_id, stock_symbol)
);

-- KYC table
CREATE TABLE IF NOT EXISTS kyc (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    pancard_number VARCHAR(20) NOT NULL UNIQUE,
    dob DATE NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Contests table
CREATE TABLE IF NOT EXISTS contests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    entry_fee DECIMAL(15,2) NOT NULL,
    contest_type ENUM('daily', 'weekly') NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL
);

-- Joined Contests table
CREATE TABLE IF NOT EXISTS joined_contests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    contest_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
    UNIQUE KEY user_contest (user_id, contest_id)
);
