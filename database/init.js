const fs=require('fs');
const {query}=require('../config/db');
const {seed}=require('./seed');

async function ensureCompatibility(){
  // Compatibility migrations for older THE ONE Bakery databases.
  // These are intentionally idempotent so the current app can repair
  // an existing database without requiring a manual DROP/CREATE.
  await query(`
    CREATE TABLE IF NOT EXISTS recipes (
      product_id INT REFERENCES products(id) ON DELETE CASCADE,
      ingredient_id INT REFERENCES inventory(id) ON DELETE CASCADE,
      quantity NUMERIC(12,3) NOT NULL CHECK(quantity>0),
      PRIMARY KEY(product_id,ingredient_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS production_capacity (
      product_id INT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
      batch_size INT NOT NULL CHECK(batch_size>0),
      minutes_per_batch INT NOT NULL CHECK(minutes_per_batch>0)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGSERIAL PRIMARY KEY,
      recipient_role VARCHAR(20),
      recipient_user INT REFERENCES users(id),
      type VARCHAR(50) NOT NULL DEFAULT 'system',
      title VARCHAR(200) NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      dedupe_key VARCHAR(180) UNIQUE
    )
  `);

  // Existing tables may already exist but be missing columns used by V7.
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_role VARCHAR(20)`);
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_user INT`);
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'system'`);
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title VARCHAR(200) DEFAULT ''`);
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT DEFAULT ''`);
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS order_id BIGINT`);
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ`);
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(180)`);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe_key ON notifications(dedupe_key)`);

  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_price NUMERIC(12,2) NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'pending_review'`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);

  // Normalize legacy databases that stored the human-readable Thai status labels
  // instead of the internal status codes used by V7.
  await query(`
    UPDATE orders SET status = CASE TRIM(status)
      WHEN 'รอตรวจสอบ' THEN 'pending_review'
      WHEN 'ยืนยันออเดอร์' THEN 'confirmed'
      WHEN 'กำลังผลิต' THEN 'in_production'
      WHEN 'รอแพ็ก' THEN 'ready_for_packing'
      WHEN 'แพ็กเสร็จ' THEN 'packed'
      WHEN 'ลูกค้ารับสินค้าแล้ว' THEN 'picked_up'
      WHEN 'ปฏิเสธออเดอร์' THEN 'rejected'
      WHEN 'ปฏิเสธ' THEN 'rejected'
      WHEN 'ยกเลิก' THEN 'cancelled'
      ELSE status
    END
    WHERE status IS NOT NULL
  `);
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) NOT NULL DEFAULT 0`);

  // Production compatibility migrations for older databases.
  // Older project versions may already have these tables with fewer columns.
  await query(`CREATE TABLE IF NOT EXISTS production_batches (
    id BIGSERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id),
    planned_qty INT NOT NULL DEFAULT 0,
    produced_qty INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'planned',
    start_at TIMESTAMPTZ,
    finish_at TIMESTAMPTZ,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await query(`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS product_id INT`);
  await query(`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS planned_qty INT NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS produced_qty INT NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'planned'`);
  await query(`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ`);
  await query(`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS finish_at TIMESTAMPTZ`);
  await query(`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS created_by INT`);
  await query(`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);

  await query(`CREATE TABLE IF NOT EXISTS production_items (
    batch_id BIGINT REFERENCES production_batches(id) ON DELETE CASCADE,
    order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 0,
    PRIMARY KEY(batch_id, order_id)
  )`);
  await query(`ALTER TABLE production_items ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 0`);

  await query(`ALTER TABLE production_capacity ADD COLUMN IF NOT EXISTS batch_size INT NOT NULL DEFAULT 1`);
  await query(`ALTER TABLE production_capacity ADD COLUMN IF NOT EXISTS minutes_per_batch INT NOT NULL DEFAULT 1`);
  await query(`CREATE TABLE IF NOT EXISTS customer_contact_requests (
    id BIGSERIAL PRIMARY KEY,
    customer_name VARCHAR(120) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    message TEXT NOT NULL,
    product_summary TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await query(`CREATE TABLE IF NOT EXISTS inventory_movements (
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
  )`);
  await query(`ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS order_id BIGINT`);
  await query(`ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS product_id INT`);
  await query(`ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS ingredient_id INT`);
  await query(`ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS movement_type VARCHAR(30) NOT NULL DEFAULT 'production_consumption'`);
  await query(`ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS quantity NUMERIC(12,3) NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS unit VARCHAR(30) NOT NULL DEFAULT 'หน่วย'`);
  await query(`ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS note TEXT`);
  await query(`ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS created_by INT`);
  await query(`ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
  await query(`CREATE INDEX IF NOT EXISTS idx_inventory_movements_order ON inventory_movements(order_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at DESC)`);
}

async function init(){
  const sql=fs.readFileSync(__dirname+'/schema.sql','utf8');
  // Execute statements one-by-one so a legacy-database migration failure
  // cannot silently prevent later CREATE TABLE/ALTER TABLE statements.
  const statements=sql
    .split(/;\s*(?=\n|$)/)
    .map(s=>s.trim())
    .filter(Boolean);
  for(const statement of statements) await query(statement);
  await ensureCompatibility();
  await query(`CREATE INDEX IF NOT EXISTS idx_notifications_role_read ON notifications(recipient_role,read_at)`);
  await seed();
}

module.exports={init};
