# THE ONE Bakery FULL V7 FINAL

ระบบจัดการออเดอร์และวางแผนการผลิตร้านเบเกอรี่ พัฒนาต่อจากแนวคิดระบบเดิม แต่จัดโครงสร้างใหม่ให้แยกส่วนและแก้ไขง่าย

## ความสามารถหลัก
- Customer Ordering + Cart + Pickup Time
- Order Review: Admin รับ/ปฏิเสธก่อนเข้าผลิต
- Workflow บังคับลำดับ: รอตรวจสอบ → ยืนยัน → กำลังผลิต → รอแพ็ก → แพ็กเสร็จ → รับสินค้า
- Role-based API: admin / kitchen / packing
- Status History และ Audit Trail
- ตรวจวัตถุดิบก่อนรับออเดอร์ พร้อม row lock ใน transaction
- ตรวจความสามารถการผลิตและคำนวณ batch/เวลา
- Production Planning + Progress
- Packing workflow
- Persistent Notifications + dedupe
- Sales Analytics
- Sales/Demand Forecasting baseline พร้อม MAE/RMSE
- Association Rule: Support / Confidence / Lift
- Production Recommendation
- Finance: Sales + income + expense
- Feedback / Recommendation collection
- Public order tracking

## Setup
1. คัดลอก `.env.example` เป็น `.env`
2. ตั้ง `DATABASE_URL` ให้ตรง PostgreSQL
3. ตั้ง `JWT_SECRET` เป็น secret ใหม่
4. `npm install`
5. `npm start`

Schema และ seed จะทำงานตอนเริ่ม Server โดยใช้ `IF NOT EXISTS` และ `ON CONFLICT` เพื่อให้เริ่มระบบได้ง่าย

## Default accounts
- admin / admin123
- kitchen / kitchen123
- packing / packing123

## Pages
- `/` ลูกค้า
- `/track.html` ติดตามออเดอร์
- `/login.html` Login
- `/admin.html` Admin
- `/kitchen.html` Production
- `/packing.html` Packing
- `/analytics.html` AI & Analytics
- `/finance.html` Finance

## AI note
ระบบมี Analytics/ML baseline ที่ใช้งานได้ทันทีจากข้อมูลจริงใน PostgreSQL โดยไม่ผูกกับ provider ภายนอก จึงไม่ต้องมี API key เพิ่ม หากภายหลังต้องการใช้ Python/scikit-learn หรือบริการ AI ภายนอก สามารถเพิ่มเป็น service ใน `/routes` หรือแยก module ได้โดยไม่ต้องรื้อ Order/Production flow
