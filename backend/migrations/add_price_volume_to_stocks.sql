-- Migration to add price and volume columns to stocks table
ALTER TABLE stocks
ADD COLUMN price DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN volume INT DEFAULT 0;
