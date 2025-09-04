-- Migration: Add prescription_id to orders table to link prescriptions and orders
-- This allows orders to be created from prescriptions while maintaining data integrity

-- Add prescription_id column to orders table
ALTER TABLE orders ADD COLUMN prescription_id INTEGER;

-- Add foreign key constraint to ensure data integrity
ALTER TABLE orders ADD CONSTRAINT fk_orders_prescription_id 
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_orders_prescription_id ON orders(prescription_id);

-- Add comment for documentation
COMMENT ON COLUMN orders.prescription_id IS 'Links order to the prescription it was created from (optional)';