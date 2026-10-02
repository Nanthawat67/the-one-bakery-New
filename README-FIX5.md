# THE ONE Bakery — PHASE10 FIX5

แก้ปัญหาฐานข้อมูลเก่าที่ไม่ครบโครงสร้างของ V7/FIX4

- เพิ่ม compatibility migration สำหรับ `notifications.read_at`
- สร้าง `recipes` และ `production_capacity` อัตโนมัติถ้ายังไม่มี
- รองรับกรณีตาราง notifications มีอยู่แล้วแต่ขาดคอลัมน์ที่ V7 ใช้
- ปรับ database init ให้รัน schema ทีละ statement เพื่อให้ migration ต่อไปทำงานได้ครบ
- สร้าง index notifications หลัง migration เสร็จ
- seed เดิมยังคงใช้บัญชี admin/kitchen/packing และสูตร/กำลังการผลิตเหมือน FIX4
