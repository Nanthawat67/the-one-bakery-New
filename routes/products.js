const express = require('express');
const { query } = require('../config/db');
const { auth, allow } = require('../middleware/auth');

const r = express.Router();

r.get(
  '/',
  async (_, res) => {
    res.json(
      (
        await query(
          'SELECT * FROM products WHERE active=true ORDER BY id'
        )
      ).rows
    );
  }
);

r.get(
  '/admin/all',
  auth,
  allow('admin'),
  async (_, res) => {
    res.json(
      (
        await query(
          'SELECT * FROM products ORDER BY active DESC,id'
        )
      ).rows
    );
  }
);

r.post(
  '/',
  auth,
  allow('admin'),
  async (req, res) => {
    const {
      name,
      price,
      image_url
    } = req.body;

    if (
      !name ||
      price === undefined ||
      Number(price) < 0
    ) {
      return res.status(400).json({
        error: 'ข้อมูลสินค้าไม่ถูกต้อง'
      });
    }

    res.status(201).json(
      (
        await query(
          `
            INSERT INTO products(
              name,
              price,
              image_url
            )
            VALUES($1,$2,$3)
            RETURNING *
          `,
          [
            name,
            price,
            image_url || null
          ]
        )
      ).rows[0]
    );
  }
);

r.put(
  '/:id',
  auth,
  allow('admin'),
  async (req, res) => {
    const {
      name,
      price,
      image_url,
      active
    } = req.body;

    const hasImage =
      Object.prototype.hasOwnProperty.call(
        req.body,
        'image_url'
      );

    const q = await query(
      `
        UPDATE products
        SET
          name = COALESCE($1,name),
          price = COALESCE($2,price),
          image_url = CASE
            WHEN $3
            THEN $4
            ELSE image_url
          END,
          active = COALESCE($5,active)
        WHERE id=$6
        RETURNING *
      `,
      [
        name ?? null,
        price === undefined ? null : price,
        hasImage,
        image_url ?? null,
        active === undefined ? null : active,
        req.params.id
      ]
    );

    if (!q.rowCount) {
      return res.status(404).json({
        error: 'ไม่พบสินค้า'
      });
    }

    res.json(q.rows[0]);
  }
);

module.exports = r;
