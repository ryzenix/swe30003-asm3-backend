-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    total_amount DECIMAL(12, 2) NOT NULL,
    shipping_address JSONB NOT NULL,
    billing_address JSONB,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'cash_on_delivery',
    payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    shipping_method VARCHAR(50) NOT NULL DEFAULT 'standard',
    shipping_cost DECIMAL(10, 2) DEFAULT 0,
    notes TEXT,
    estimated_delivery_date DATE,
    prescription_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- CONSTRAINT fk_orders_user_id FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT chk_orders_status CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
    CONSTRAINT chk_orders_payment_method CHECK (payment_method IN ('cash_on_delivery', 'bank_transfer', 'credit_card', 'e_wallet')),
    CONSTRAINT chk_orders_payment_status CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    CONSTRAINT chk_orders_shipping_method CHECK (shipping_method IN ('standard', 'express', 'same_day', 'grab')),
    CONSTRAINT chk_orders_total_amount CHECK (total_amount >= 0),
    CONSTRAINT chk_orders_shipping_cost CHECK (shipping_cost >= 0)
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
    product_title VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100),
    requires_prescription BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_order_items_order_id FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_product_id FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CONSTRAINT chk_order_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_order_items_unit_price CHECK (unit_price >= 0),
    CONSTRAINT chk_order_items_total_price CHECK (total_price >= 0)
);

-- Prescriptions table
CREATE TABLE IF NOT EXISTS prescriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    patient_name VARCHAR(255) NOT NULL,
    doctor_name VARCHAR(255) NOT NULL,
    doctor_license VARCHAR(100),
    clinic_name VARCHAR(255),
    issue_date DATE NOT NULL,
    expiry_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    images JSONB DEFAULT '[]',
    notes TEXT,
    diagnosis TEXT,
    reviewed_by INTEGER,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- CONSTRAINT fk_prescriptions_user_id FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    -- CONSTRAINT fk_prescriptions_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chk_prescriptions_status CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    CONSTRAINT chk_prescriptions_dates CHECK (expiry_date IS NULL OR expiry_date > issue_date)
);

-- Prescription items table
CREATE TABLE IF NOT EXISTS prescription_items (
    id SERIAL PRIMARY KEY,
    prescription_id INTEGER NOT NULL,
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    duration VARCHAR(100),
    quantity INTEGER,
    instructions TEXT,
    product_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_prescription_items_prescription_id FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
    CONSTRAINT fk_prescription_items_product_id FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    CONSTRAINT chk_prescription_items_quantity CHECK (quantity IS NULL OR quantity > 0)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_prescriptions_user_id ON prescriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created_at ON prescriptions(created_at);
CREATE INDEX IF NOT EXISTS idx_prescriptions_issue_date ON prescriptions(issue_date);
CREATE INDEX IF NOT EXISTS idx_prescriptions_expiry_date ON prescriptions(expiry_date);

CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription_id ON prescription_items(prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_items_product_id ON prescription_items(product_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (optional)
-- Sample orders
INSERT INTO orders (user_id, status, total_amount, shipping_address, payment_method, payment_status, shipping_method, shipping_cost, notes) VALUES
(1, 'pending', 150000, '{"fullName": "Nguyễn Văn A", "phone": "0123456789", "address": "123 Đường ABC", "district": "Quận 1", "province": "TP. Hồ Chí Minh"}', 'cash_on_delivery', 'pending', 'standard', 30000, 'Giao hàng giờ hành chính'),
(1, 'delivered', 250000, '{"fullName": "Nguyễn Văn A", "phone": "0123456789", "address": "123 Đường ABC", "district": "Quận 1", "province": "TP. Hồ Chí Minh"}', 'cash_on_delivery', 'paid', 'express', 50000, NULL)
ON CONFLICT DO NOTHING;

-- Sample order items
INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, product_title, product_sku, requires_prescription) VALUES
(1, 1, 2, 50000, 100000, 'Paracetamol 500mg', 'PARA500', false),
(1, 2, 1, 20000, 20000, 'Vitamin C 1000mg', 'VITC1000', false),
(2, 1, 1, 50000, 50000, 'Paracetamol 500mg', 'PARA500', false),
(2, 3, 2, 75000, 150000, 'Amoxicillin 500mg', 'AMOX500', true)
ON CONFLICT DO NOTHING;

-- Sample prescriptions
INSERT INTO prescriptions (user_id, patient_name, doctor_name, doctor_license, clinic_name, issue_date, expiry_date, status, notes, diagnosis) VALUES
(1, 'Nguyễn Văn A', 'BS. Trần Thị B', 'BS123456', 'Phòng khám Đa khoa ABC', '2024-01-15', '2024-02-15', 'approved', 'Uống sau ăn', 'Viêm họng cấp'),
(1, 'Nguyễn Văn A', 'BS. Lê Văn C', 'BS789012', 'Bệnh viện XYZ', '2024-01-10', '2024-01-25', 'pending', NULL, 'Cảm cúm')
ON CONFLICT DO NOTHING;

-- Sample prescription items
INSERT INTO prescription_items (prescription_id, medication_name, dosage, frequency, duration, quantity, instructions, product_id) VALUES
(1, 'Amoxicillin', '500mg', '3 lần/ngày', '7 ngày', 21, 'Uống sau ăn 30 phút', 3),
(1, 'Paracetamol', '500mg', '3 lần/ngày khi sốt', '5 ngày', 15, 'Uống khi sốt trên 38.5°C', 1),
(2, 'Vitamin C', '1000mg', '1 lần/ngày', '10 ngày', 10, 'Uống sau ăn sáng', 2)
ON CONFLICT DO NOTHING;