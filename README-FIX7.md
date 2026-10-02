# THE ONE Bakery — PHASE10 FIX7

แก้จาก FIX6 ตาม runtime ที่พบจริง

## แก้ไข
1. `/api/orders` และ `getOrder()` ไม่ใช้ `GROUP BY n.id` กับ CTE อีกต่อไป เปลี่ยนเป็น correlated subquery สำหรับ `order_items` ลดปัญหา PostgreSQL `must appear in GROUP BY` และทำให้ Admin โหลดออเดอร์ได้
2. หน้า Admin แยกการโหลด orders / notifications / finance เพื่อให้ส่วนหนึ่งล้มไม่ทำให้ทั้งหน้าเสีย
3. เพิ่ม `/api/orders/track/number/:dailyNo?date=YYYY-MM-DD` สำหรับติดตามด้วยเลขออเดอร์ประจำวัน เช่น `4`, `#4`, `๔`
4. ลิงก์ติดตามออเดอร์หลังสั่งซื้อเก็บ `order_id`, `order_number`, `order_date` ใน localStorage
5. หน้าเลือกสินค้าเพิ่มส่วน “ติดตามออเดอร์” และปุ่มเปิดหน้าติดตาม ทำให้กลับเข้ามาดูออเดอร์เดิมได้โดยไม่ต้องสั่งใหม่
6. หน้า Track มีช่องเลือกวันที่ และรองรับเลขไทย / #4
7. คง `.env`, migration, capacity-contact และการแก้จาก FIX5/FIX6 ไว้
