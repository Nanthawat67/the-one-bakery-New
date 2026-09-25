const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

const r = express.Router();

r.post('/login', async (req, res) => {
  try {
    const {
      username,
      password
    } = req.body;

    const q = await query(
      'SELECT id,username,password_hash,role,display_name FROM users WHERE username=$1 AND active=true',
      [username]
    );

    if (
      !q.rowCount ||
      !(
        await bcrypt.compare(
          password,
          q.rows[0].password_hash
        )
      )
    ) {
      return res
        .status(401)
        .json({
          error:
            'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
        });
    }

    const u = q.rows[0];

    const token = jwt.sign(
      {
        id: u.id,
        username: u.username,
        role: u.role,
        display_name: u.display_name
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '12h'
      }
    );

    res.json({
      token,
      user: {
        id: u.id,
        username: u.username,
        role: u.role,
        display_name: u.display_name
      }
    });

  } catch (e) {
    console.error(e);

    res
      .status(500)
      .json({
        error: 'ไม่สามารถเข้าสู่ระบบได้'
      });
  }
});

module.exports = r;
