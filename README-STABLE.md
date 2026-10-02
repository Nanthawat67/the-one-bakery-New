# THE ONE Bakery — PHASE 10 STABLE BUILD

ชุดนี้เป็นตัวรวมล่าสุดสำหรับศึกษา/ทดสอบ โดยเน้นความเสถียรของ Node.js + PostgreSQL

## สิ่งที่ปรับเรื่องความเสถียร
- Server เริ่มฟังพอร์ตได้แม้ PostgreSQL ยังเชื่อมต่อไม่ได้
- `/api/health` แสดงสถานะฐานข้อมูล
- Database init ล้มแล้วไม่ `process.exit()` และ retry ทุก 5 วินาที
- Async route error ถูกส่งเข้า Express error handler แทนการปล่อย Promise rejection
- มีตัวดัก `unhandledRejection` / `uncaughtException` เพื่อไม่ให้ development server ดับทันที
- PostgreSQL pool มี connection timeout และ pool error logging
- Seed เป็น idempotent: restart แล้วไม่สร้างสินค้า/วัตถุดิบ/สูตรซ้ำ และไม่เขียนทับการแก้ไขของเจ้าของร้าน
- รองรับ migration column ที่ขาดจากฐานข้อมูลเวอร์ชันก่อนหน้า
- API fetch ฝั่ง Browser มี timeout 10 วินาทีและข้อความ error ที่อ่านง่าย
- เอา `pickup_at` ออกจาก schema และ order flow ตามที่คุยกัน

## วิธีรัน
```bash
cd ~/v7
npm install
npm start
```

เปิด:
- http://localhost:3000/
- http://localhost:3000/login.html

ตรวจฐานข้อมูล:
```bash
curl http://localhost:3000/api/health
```

## Database
`.env` ที่รวมมาใช้:
```env
PORT=3000
DATABASE_URL=postgresql://postgres:1234@localhost:5432/the_one_bakery_v7
JWT_SECRET=the-one-bakery-secret-2026-change-this
DB_POOL_MAX=10
```

ถ้ารหัส PostgreSQL ไม่ใช่ `1234` ให้แก้ `DATABASE_URL` ก่อน `npm start`.

## บัญชีทดสอบ
- admin / admin123
- kitchen / kitchen123
- packing / packing123

## ขอบเขตตัวรวม
Customer, Cart/Checkout, Order Workflow, Admin, Product Management, Inventory/วัตถุดิบ, Recipe, Production, Kitchen, Packing, Finance, Analytics, Association Rule, Forecasting, Notification และ Tracking

> ไฟล์นี้เป็น Stable Build สำหรับทดสอบและศึกษา ไม่ได้หมายความว่าได้รับการรับรองการส่งงาน 100% จนกว่าจะทดสอบกับ PostgreSQL และ Browser ในเครื่องจริงครบทุก Flow
