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
  allow('admin'),
  async (req, res) => {
    const d =
      req.query.date ||
      new Date().toISOString().slice(0, 10);

    const sales = (
      await query(
        `SELECT
          COALESCE(SUM(total_price),0)::float sales
         FROM orders
         WHERE DATE(created_at)=$1
           AND status NOT IN ('rejected','cancelled')`,
        [d]
      )
    ).rows[0].sales;

    const t = (
      await query(
        `SELECT
          type,
          COALESCE(SUM(amount),0)::float amount
         FROM finance_transactions
         WHERE transaction_date=$1
         GROUP BY type`,
        [d]
      )
    ).rows;

    res.json({
      date: d,
      sales,
      transactions: t
    });
  }
);

r.post(
  '/',
  auth,
  allow('admin'),
  async (req, res) => {
    const {
      type,
      category,
      amount,
      note,
      transaction_date
    } = req.body;

    res
      .status(201)
      .json(
        (
          await query(
            `INSERT INTO finance_transactions(
              type,
              category,
              amount,
              note,
              transaction_date,
              created_by
            )
            VALUES($1,$2,$3,$4,$5,$6)
            RETURNING *`,
            [
              type,
              category,
              amount,
              note,
              transaction_date || new Date(),
              req.user.id
            ]
          )
        ).rows[0]
      );
  }
);

module.exports = r;
