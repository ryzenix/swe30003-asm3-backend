-- Migration to remove foreign key constraints that prevent superusers from creating orders/prescriptions
-- Run this on your existing database

-- Drop foreign key constraints from orders table
ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_user_id;

-- Drop foreign key constraints from prescriptions table  
ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS fk_prescriptions_user_id;
ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS fk_prescriptions_reviewed_by;

-- Note: This allows superusers (who exist in superusers table) to create orders and prescriptions
-- Application logic in Authenticator.js now handles validation for both user types