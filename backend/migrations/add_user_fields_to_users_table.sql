-- Migration to add state, email, and security_question columns to users table

ALTER TABLE users
ADD COLUMN state VARCHAR(100) DEFAULT NULL,
ADD COLUMN email VARCHAR(255) UNIQUE DEFAULT NULL,
ADD COLUMN security_question VARCHAR(255) DEFAULT NULL;
