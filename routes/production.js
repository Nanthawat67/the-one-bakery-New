const express = require('express');
const { query, pool } = require('../config/db');
const { auth, allow } = require('../middleware/auth');

const r = express.Router();

const ensureCapacityTable = (db = { query }) => db.query(`
  CREATE TABLE IF NOT EXISTS production_capacity (
    product_id INT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    batch_size INT NOT NULL CHECK(batch_size > 0),
    minutes_per_batch INT NOT NULL CHECK(minutes_per_batch > 0)
  )
`);

r.get('/plan', auth, allow('admin', 'kitchen'), async (_req, res) => {
  await ensureCapacityTable();
  const q = await query(`
    SELECT p.id,p.name,
           SUM(oi.quantity)::int required,
           pc.batch_size,
           pc.minutes_per_batch,
           CEIL(SUM(oi.quantity)::numeric/pc.batch_size)::int rounds
    FROM products p
    JOIN order_items oi ON oi.product_id=p.id
    JOIN orders o ON o.id=oi.order_id
    JOIN production_capacity pc ON pc.product_id=p.id
    WHERE o.status IN ('confirmed','in_production')
    GROUP BY p.id,p.name,pc.batch_size,pc.minutes_per_batch
    ORDER BY MIN(o.created_at)
  `);

  res.json(q.rows.map(x => ({
    ...x,
    estimated_minutes: Number(x.rounds) * Number(x.minutes_per_batch),
    recommended_start: new Date(Date.now() + 5 * 60000).toISOString()
  })));
});

r.post('/batches', auth, allow('admin', 'kitchen'), async (req, res) => {
  const { product_id, planned_qty, order_ids = [] } = req.body;
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await ensureCapacityTable(c);

    const cap = (await c.query(
      'SELECT * FROM production_capacity WHERE product_id=$1',
      [product_id]
    )).rows[0];

    if (!cap) throw Error('ยังไม่ได้กำหนดกำลังการผลิต');

    const batch = Math.ceil(Number(planned_qty) / Number(cap.batch_size));
    const b = (await c.query(
      `INSERT INTO production_batches(product_id,planned_qty,created_by)
       VALUES($1,$2,$3) RETURNING *`,
      [product_id, planned_qty, req.user.id]
    )).rows[0];

    for (const id of order_ids) {
      await c.query(
        `INSERT INTO production_items(batch_id,order_id,quantity)
         VALUES(
           $1,
           $2,
           (SELECT COALESCE(SUM(quantity),0)
            FROM order_items
            WHERE order_id=$2 AND product_id=$3)
         )`,
        [b.id, id, product_id]
      );
    }

    await c.query('COMMIT');
    res.status(201).json({ ...b, rounds: batch });
  } catch (e) {
    await c.query('ROLLBACK');
    res.status(409).json({ error: e.message });
  } finally {
    c.release();
  }
});

r.get('/batches', auth, allow('admin', 'kitchen'), async (_req, res) => {
  try {
    await ensureCapacityTable();
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

    const rows = (await query(`
      SELECT b.*,p.name,
             COALESCE(pc.batch_size,1) AS batch_size,
             COALESCE(pc.minutes_per_batch,1) AS minutes_per_batch
      FROM production_batches b
      JOIN products p ON p.id=b.product_id
      LEFT JOIN production_capacity pc ON pc.product_id=b.product_id
      ORDER BY b.created_at DESC
    `)).rows;
    res.json(rows);
  } catch (e) {
    console.error('[API ERROR] GET /api/production/batches', e);
    res.status(500).json({error:'ไม่สามารถโหลดรายการ Batch การผลิตได้', detail:e.message});
  }
});

r.patch('/batches/:id', auth, allow('admin', 'kitchen'), async (req, res) => {
  const { produced_qty, status } = req.body;
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const b = (await c.query(
      'SELECT * FROM production_batches WHERE id=$1 FOR UPDATE',
      [req.params.id]
    )).rows[0];

    if (!b) throw Error('ไม่พบงานผลิต');
    if (produced_qty < 0 || produced_qty > b.planned_qty) {
      throw Error('จำนวนผลิตไม่ถูกต้อง');
    }

    const s = status || (produced_qty === b.planned_qty ? 'done' : 'producing');
    await c.query(
      `UPDATE production_batches
       SET produced_qty=$1,
           status=$2,
           start_at=COALESCE(start_at,CASE WHEN $2='producing' THEN NOW() ELSE start_at END),
           finish_at=CASE WHEN $2='done' THEN NOW() ELSE NULL END
       WHERE id=$3`,
      [produced_qty, s, b.id]
    );

    await c.query('COMMIT');
    res.json({ message: 'บันทึกความคืบหน้าการผลิตแล้ว' });
  } catch (e) {
    await c.query('ROLLBACK');
    res.status(409).json({ error: e.message });
  } finally {
    c.release();
  }
});

module.exports = r;
