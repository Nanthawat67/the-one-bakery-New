# Phase 10 - Additional Fixes

## 1) Customer order summary
- หน้า `/` แสดงรายการที่เลือกก่อน Checkout อย่างชัดเจน
- แสดงชื่อสินค้า
- แสดงราคาต่อชิ้น
- แสดงจำนวน พร้อมปุ่ม + / -
- แสดงราคารวมต่อรายการ
- ลบรายการได้
- แสดงยอดรวมทั้งหมด
- ไม่มีช่องเวลารับสินค้า
- หลังส่งออเดอร์สำเร็จมีลิงก์ไปหน้า Tracking พร้อม order id

## 2) .env
เพิ่ม `.env` สำหรับการรัน local โดยใช้:
- PORT=3000
- DATABASE_URL=postgresql://postgres:1234@localhost:5432/the_one_bakery_v7
- JWT_SECRET=...

หมายเหตุ: ค่า password ในชุดนี้อ้างอิงจาก `.env.example` ของโปรเจกต์ที่กำหนดไว้เป็น `1234` หาก PostgreSQL ในเครื่องใช้ password อื่น ให้แก้เฉพาะ `DATABASE_URL` ก่อนรัน
