-- Migration to rename pancard_number to aadhar_number in kyc table
ALTER TABLE kyc CHANGE COLUMN pancard_number aadhar_number VARCHAR(255);

-- Rename pan_card_photo column to aadhar_card_photo in kyc table
ALTER TABLE kyc CHANGE COLUMN pan_card_photo aadhar_card_photo VARCHAR(255);
