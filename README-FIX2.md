# THE ONE Bakery — Phase 10 Stable Fix 2

แก้ตามการทดสอบของผู้ใช้:

1. เลขออเดอร์ที่แสดงหน้า Admin รีเซ็ตตามวัน (daily_no) โดยฐานข้อมูลยังคงใช้ id ภายในแบบต่อเนื่อง
2. หน้า Admin แสดงออเดอร์ของ "วันนี้" เป็นค่าเริ่มต้น และเลือกวันที่ย้อนหลังได้ หรือกด "ดูทั้งหมด"
3. Product Management: แก้ไขสินค้า / เปิดขาย / ปิดขาย ใช้งานได้ โดยไม่ส่ง JSON ฝังใน onclick
4. Product API รองรับการแก้บางฟิลด์และการ toggle active โดยไม่ทำให้ name/price หาย
5. Inventory / Stock: ปุ่มแก้ไขใช้ข้อมูลจาก cache ไม่ฝัง JSON ใน onclick
6. Tracking / Kitchen / Packing แสดง daily order number ให้สอดคล้องกัน
7. Customer checkout แสดงเลขออเดอร์รายวันจาก order_number

Validation:
- Node backend syntax check: PASS
- Frontend inline script syntax check: PASS
- npm test: 3/3 PASS
- End-to-end PostgreSQL/Browser verification: ต้องทดสอบบนเครื่องผู้ใช้
