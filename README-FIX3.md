# THE ONE Bakery — PHASE 10 FIX 3

แก้ไขจาก PHASE10 STABLE FIX2 ตามงานล่าสุด:

1. Customer Ordering
   - หน้าเลือกสินค้าไม่บังคับให้เลื่อนลงมากรอกข้อมูลอีก
   - ใช้ตะกร้าสินค้าแยกหน้า `/cart.html`
   - เก็บตะกร้าด้วย localStorage
   - ตรวจสอบรายการ/จำนวน/ยอดรวมในตะกร้า
   - กรอกชื่อและเบอร์โทรในหน้าตะกร้าก่อนส่งออเดอร์

2. AI & Analytics
   - แก้ SQL alias ที่ทำให้ `/api/analytics/forecast` HTTP 500
   - แยกการโหลดแต่ละ Analytics ไม่ให้ API ส่วนหนึ่งล้มแล้วทำให้ส่วนอื่นว่างทั้งหมด
   - แสดง Forecast 7 วัน
   - เพิ่ม Production Recommendation จากค่าเฉลี่ยจำนวนขายย้อนหลัง
   - แสดง Association Rule พร้อมข้อความกรณีข้อมูลไม่พอ
   - แสดงสินค้าขายดีจากข้อมูลออเดอร์จริง

3. Product Image Management
   - Admin เลือกรูปจากเครื่องด้วย file picker
   - Preview ก่อนบันทึก
   - ระบบ crop กลางภาพเป็นสี่เหลี่ยมและบีบอัดเป็น JPEG เพื่อเหมาะกับเว็บ
   - แก้ไขสินค้าและเลือกเปลี่ยนรูปได้
   - ยังคงรองรับ image_url เดิมในฐานข้อมูลและรูปเดิมที่มีอยู่

ไม่มีการเปลี่ยน database schema หลักสำหรับ 3 งานนี้ และไม่เพิ่ม dependency ใหม่

## FIX 4 — Runtime / Compatibility

4. Customer quantity
   - ค่าเริ่มต้นในช่องจำนวนสินค้าหน้าเลือกสินค้าเป็น `0`
   - ระบบไม่เพิ่มสินค้าเข้าตะกร้าจนกว่าจะเลือกอย่างน้อย 1 ชิ้น

5. Production capacity compatibility
   - เพิ่ม migration แบบ idempotent สำหรับตาราง `production_capacity`
   - ป้องกันฐานข้อมูลเก่าที่ไม่มีตารางนี้จากการล้มตอนส่งออเดอร์/เปิดงานผลิต

6. Login accounts
   - seed จะอัปเดต `password_hash` ของบัญชีทดสอบเดิมทุกครั้ง เพื่อให้รหัสเริ่มต้นใช้งานได้จริง
   - บัญชีทดสอบ: `admin/admin123`, `kitchen/kitchen123`, `packing/packing123`
