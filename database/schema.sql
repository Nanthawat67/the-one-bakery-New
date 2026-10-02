CREATE TABLE IF NOT EXISTS users (
 id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, password_hash TEXT NOT NULL,
 role VARCHAR(20) NOT NULL CHECK(role IN ('admin','kitchen','packing')), display_name VARCHAR(100) NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS products (
 id SERIAL PRIMARY KEY, name VARCHAR(150) NOT NULL, price NUMERIC(12,2) NOT NULL CHECK(price>=0), image_url TEXT,
 active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS inventory (
 id SERIAL PRIMARY KEY, name VARCHAR(150) NOT NULL, unit VARCHAR(30) NOT NULL, stock NUMERIC(12,3) NOT NULL DEFAULT 0,
 reorder_level NUMERIC(12,3) NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS recipes (
 product_id INT REFERENCES products(id) ON DELETE CASCADE, ingredient_id INT REFERENCES inventory(id) ON DELETE CASCADE,
 quantity NUMERIC(12,3) NOT NULL CHECK(quantity>0), PRIMARY KEY(product_id,ingredient_id)
);
CREATE TABLE IF NOT EXISTS production_capacity (
 product_id INT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE, batch_size INT NOT NULL CHECK(batch_size>0),
 minutes_per_batch INT NOT NULL CHECK(minutes_per_batch>0)
);
CREATE TABLE IF NOT EXISTS orders (
 id BIGSERIAL PRIMARY KEY, customer_name VARCHAR(120) NOT NULL, phone VARCHAR(40) NOT NULL,
 total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
 status VARCHAR(40) NOT NULL DEFAULT 'pending_review', cancel_reason TEXT, rejection_reason TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS order_items (
 id BIGSERIAL PRIMARY KEY, order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE, product_id INT REFERENCES products(id),
 quantity INT NOT NULL CHECK(quantity>0), unit_price NUMERIC(12,2) NOT NULL
);
CREATE TABLE IF NOT EXISTS order_status_history (
 id BIGSERIAL PRIMARY KEY, order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE, from_status VARCHAR(40), to_status VARCHAR(40) NOT NULL,
 changed_by INT REFERENCES users(id), note TEXT, changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS production_batches (
 id BIGSERIAL PRIMARY KEY, product_id INT REFERENCES products(id), planned_qty INT NOT NULL, produced_qty INT NOT NULL DEFAULT 0,
 status VARCHAR(30) NOT NULL DEFAULT 'planned', start_at TIMESTAMPTZ, finish_at TIMESTAMPTZ, created_by INT REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS production_items (
 batch_id BIGINT REFERENCES production_batches(id) ON DELETE CASCADE, order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
 quantity INT NOT NULL, PRIMARY KEY(batch_id,order_id)
);
CREATE TABLE IF NOT EXISTS notifications (
 id BIGSERIAL PRIMARY KEY, recipient_role VARCHAR(20), recipient_user INT REFERENCES users(id), type VARCHAR(50) NOT NULL,
 title VARCHAR(200) NOT NULL, message TEXT NOT NULL, order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
 read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), dedupe_key VARCHAR(180) UNIQUE
);
CREATE TABLE IF NOT EXISTS customer_contact_requests (
 id BIGSERIAL PRIMARY KEY,
 customer_name VARCHAR(120) NOT NULL,
 phone VARCHAR(40) NOT NULL,
 message TEXT NOT NULL,
 product_summary TEXT,
 status VARCHAR(30) NOT NULL DEFAULT 'new',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS feedback (
 id BIGSERIAL PRIMARY KEY, user_name VARCHAR(100), role VARCHAR(30), rating INT CHECK(rating BETWEEN 1 AND 5), category VARCHAR(80), comment TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS finance_transactions (
 id BIGSERIAL PRIMARY KEY, type VARCHAR(20) CHECK(type IN ('income','expense')), category VARCHAR(100) NOT NULL,
 amount NUMERIC(12,2) NOT NULL CHECK(amount>=0), note TEXT, transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
 created_by INT REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS inventory_movements (
 id BIGSERIAL PRIMARY KEY,
 order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
 product_id INT REFERENCES products(id) ON DELETE SET NULL,
 ingredient_id INT NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
 movement_type VARCHAR(30) NOT NULL DEFAULT 'production_consumption',
 quantity NUMERIC(12,3) NOT NULL CHECK(quantity>0),
 unit VARCHAR(30) NOT NULL,
 note TEXT,
 created_by INT REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE orders DROP COLUMN IF EXISTS pickup_at;
-- Compatibility migrations for an existing THE ONE Bakery V7 database.
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS unit VARCHAR(30) NOT NULL DEFAULT 'หน่วย';
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS stock NUMERIC(12,3) NOT NULL DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS reorder_level NUMERIC(12,3) NOT NULL DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'pending_review';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_price NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_role VARCHAR(20);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_user INT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'system';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS order_id BIGINT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(180);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status,created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_order ON inventory_movements(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at DESC);
