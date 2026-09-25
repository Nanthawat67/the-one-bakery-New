const express = require('express');
const { query } = require('../config/db');
const {
  auth,
  allow
} = require('../middleware/auth');

const r = express.Router();

r.get(
  '/',
  auth,
  allow('admin', 'kitchen'),
  async (_, res) =>
    res.json(
      (
        await query(
          'SELECT * FROM inventory ORDER BY name'
        )
      ).rows
    )
);

r.post(
  '/',
  auth,
  allow('admin'),
  async (req, res) =>
    res
      .status(201)
      .json(
        (
          await query(
            `INSERT INTO inventory(
              name,
              unit,
              stock,
              reorder_level
            )
            VALUES($1,$2,$3,$4)
            RETURNING *`,
            [
              req.body.name,
              req.body.unit,
              req.body.stock || 0,
              req.body.reorder_level || 0
            ]
          )
        ).rows[0]
      )
);

r.patch(
  '/:id',
  auth,
  allow('admin'),
  async (req, res) =>
    res.json(
      (
        await query(
          `UPDATE inventory
           SET
             name=COALESCE($1,name),
             unit=COALESCE($2,unit),
             stock=COALESCE($3,stock),
             reorder_level=COALESCE($4,reorder_level),
             updated_at=NOW()
           WHERE id=$5
           RETURNING *`,
          [
            req.body.name,
            req.body.unit,
            req.body.stock,
            req.body.reorder_level,
            req.params.id
          ]
        )
      ).rows[0]
    )
);

r.get(
  '/recipes/:productId',
  auth,
  allow('admin', 'kitchen'),
  async (req, res) => {
    const rows = (
      await query(
        `SELECT
          r.product_id,
          r.ingredient_id,
          r.quantity,
          i.name,
          i.unit,
          i.stock
         FROM recipes r
         JOIN inventory i
           ON i.id=r.ingredient_id
         WHERE r.product_id=$1
         ORDER BY i.name`,
        [req.params.productId]
      )
    ).rows;

    res.json(rows);
  }
);

r.post(
  '/recipes',
  auth,
  allow('admin'),
  async (req, res) => {
    const {
      product_id,
      ingredient_id,
      quantity
    } = req.body;

    if (
      !product_id ||
      !ingredient_id ||
      !(Number(quantity) > 0)
    ) {
      return res
        .status(400)
        .json({
          error:
            'ข้อมูลสูตรไม่ครบหรือปริมาณไม่ถูกต้อง'
        });
    }

    const row = (
      await query(
        `INSERT INTO recipes(
          product_id,
          ingredient_id,
          quantity
        )
        VALUES($1,$2,$3)
        ON CONFLICT(product_id,ingredient_id)
        DO UPDATE SET
          quantity=EXCLUDED.quantity
        RETURNING *`,
        [
          product_id,
          ingredient_id,
          quantity
        ]
      )
    ).rows[0];

    res
      .status(201)
      .json(row);
  }
);

r.delete(
  '/recipes/:productId/:ingredientId',
  auth,
  allow('admin'),
  async (req, res) => {
    await query(
      'DELETE FROM recipes WHERE product_id=$1 AND ingredient_id=$2',
      [
        req.params.productId,
        req.params.ingredientId
      ]
    );

    res.json({
      ok: true
    });
  }
);

r.get(
  '/check/:productId/:qty',
  auth,
  allow('admin', 'kitchen'),
  async (req, res) => {
    const rows = (
      await query(
        `SELECT
          i.name,
          i.unit,
          i.stock,
          r.quantity*$2::numeric required
         FROM recipes r
         JOIN inventory i
           ON i.id=r.ingredient_id
         WHERE r.product_id=$1`,
        [
          req.params.productId,
          req.params.qty
        ]
      )
    ).rows;

    res.json({
      ok: rows.every(
        x =>
          Number(x.stock) >=
          Number(x.required)
      ),
      items: rows
    });
  }
);

module.exports = r;
