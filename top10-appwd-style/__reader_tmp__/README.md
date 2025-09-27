# WDBank Gamify — Read‑only from OpenSheet (Teacher/Admin Views)
ชุดนี้ออกแบบสำหรับ **อ่านข้อมูลธุรกรรมจาก Google Sheet ผ่าน OpenSheet** (read‑only) โดยไม่บันทึกธุรกรรมในแอป

## แกนการทำงาน
- ดึง JSON จาก URL: `https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortรายการฝากและถอน`
- แปลงคอลัมน์แบบยืดหยุ่น (พยายามแม็พชื่อหัวตารางภาษาไทยอัตโนมัติ)
- คำนวณ:
  - คะแนน (สูตร log10 ของยอดฝาก + โบนัส Early Bird + โบนัสต่อสตรีค)
  - สตรีครายวัน (Asia/Bangkok)
  - “วันนี้ฝากหรือยัง”, “ล่าสุดฝากเมื่อไร”
- มุมมอง **ครูประจำชั้น**: เลือกห้อง → ตารางนักเรียนในห้องนั้น (คะแนน, สตรีค, แชร์เตือน, สถานะวันนี้)
- มุมมอง **ผู้บริหาร**: สรุปทั้งโรงเรียน + Leaderboard + สรุปตามห้อง

## วิธีใช้ (ผสานกับ WDBank v6.6.9‑clean)
1) คัดลอกไฟล์ทั้งหมดไปยังโฟลเดอร์เดียวกับ `index.html` ของโปรเจกต์
2) เปิด `index.html` แล้วเติมก่อน `</body>`:
   ```html
   <script type="module" src="./reader.config.js"></script>
   <script type="module" src="./reader.core.js"></script>
   <script type="module" src="./view.teacher.js"></script>
   <script type="module" src="./view.admin.js"></script>
   <script type="module" src="./reader.init.js"></script>
   ```
3) เพิ่มปุ่ม/ทางเข้า เช่น:
   ```html
   <a href="#gamify-teacher" class="btn">ครูประจำชั้น</a>
   <a href="#gamify-admin" class="btn">ผู้บริหาร</a>
   ```

> ค่าเริ่มต้นของกติกาอ่านจาก `window.GAMIFY` (ถ้าไม่มีจะกำหนดใน `reader.config.js`)
