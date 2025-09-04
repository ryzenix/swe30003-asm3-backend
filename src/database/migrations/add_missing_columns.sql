-- Migration to fix authentication and checkout issues
-- Run this on your existing database

-- Add is_active column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add is_active column to superusers table if it doesn't exist  
ALTER TABLE superusers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Update existing records to have is_active = TRUE
UPDATE users SET is_active = TRUE WHERE is_active IS NULL;
UPDATE superusers SET is_active = TRUE WHERE is_active IS NULL;

-- Drop foreign key constraints that prevent superusers from creating orders/prescriptions
ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_user_id;
ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS fk_prescriptions_user_id;
ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS fk_prescriptions_reviewed_by;

-- Drop and recreate the shipping method constraint to include 'grab'
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_shipping_method;
ALTER TABLE orders ADD CONSTRAINT chk_orders_shipping_method 
    CHECK (shipping_method IN ('standard', 'express', 'same_day', 'grab'));

-- Note: This fixes the authentication issues and allows superuser checkout