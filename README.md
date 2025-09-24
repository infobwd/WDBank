# WDBank v6.6 — School Savings Dashboard (LIFF + LINE Share)

**เป้าหมาย:** สร้างวัฒนธรรม “ออมก่อนใช้” ในโรงเรียน ผ่านแดชบอร์ดที่ใช้งานได้ทั้ง **ใน LINE และนอก LINE** (เบราว์เซอร์ทั่วไป) พร้อม **แชร์ผล/ประกาศ** ไปยังกลุ่ม LINE ได้ทันที

> โปรเจกต์นี้พัฒนาต่อยอดจาก v6.4.2 → v6.5 (Mini Tips + Teacher Mode) → **v6.6 (Leaderboard + Graphs + Report Hub)** โดย **ไม่ทับของเดิม** และคงพฤติกรรมเดิมทั้งหมดไว้

---

## ภาพรวมสถาปัตยกรรม

- **Front-end เท่านั้น** (HTML/CSS/JS + CDN): ไม่มีเซิร์ฟเวอร์ฝั่งเรา → โหลดเร็ว, deploy ง่าย (GitHub Pages)
- **Data Source**
  - แหล่งข้อมูลธุรกรรม/บัญชีจาก Google Sheets ผ่าน `opensheet.elk.sh` (JSON)
  - (ออปชัน) **Supabase**: อ่านค่า `supabase_url` + `supabase_anon_key` จากตาราง `settings` เพื่อแสดงข้อมูลผู้ใช้/โปรไฟล์บน nav (read-only)
- **LINE LIFF (Login + Share)**
  - ใช้ `liff.init()` + `liff.isLoggedIn()` เพื่อเช็คสถานะ และ `liff.login()` เมื่อต้องแชร์
  - เชียร์ให้ **ใช้ LIFF เดียว** สำหรับทุกหน้า (โค้ดรองรับ) — ทำงานได้ดีแม้เปิดจากเบราว์เซอร์นอก LINE
- **PDF Export**
  - ใช้ `jsPDF` แปลงกราฟ/สรุปเป็นไฟล์ PDF (สำหรับผู้บริหาร/ผู้ปกครอง)
- **Charts**
  - ใช้ `Chart.js` วาดกราฟแท่ง/เส้น ใน **Report Hub**

---

## ฟีเจอร์หลักใน v6.6

1) **Mini Tips** (เคล็ด(ไม่)ลับการออม)  
   - แสดงทิปบนหน้าแรก เปลี่ยนรายวัน + ปุ่มสุ่ม

2) **การ์ด “เดือนนี้ออมบ่อยกว่าค่าเฉลี่ยของโรงเรียน +X%”**  
   - คำนวณจาก **จำนวนครั้งฝาก/บัญชี** เดือนนี้ เทียบ **เดือนก่อน**

3) **Leaderboard** (เลือกช่วงเวลา: **สัปดาห์/เดือน/เทอม**)  
   - จัดอันดับจากจำนวนครั้งฝาก + โบนัส 0.5 หาก **ฝาก ≥ ค่าเฉลี่ยโรงเรียน** ในช่วงนั้น
   - แสดง **Top 10** พร้อมชั้นและยอดรวมต่อบัญชี
   - **แชร์ LINE** เป็น Flex Message + ปุ่ม “เปิด WDBank (LIFF)”

4) **Report Hub**  
   - กราฟแท่ง: **จำนวนครั้งฝาก (Top 10)** + **ยอดฝากรวม**  
   - กราฟเส้น: **แนวโน้มยอดฝากรายวัน**  
   - **บันทึก PDF** สำหรับสรุปรายสัปดาห์/เดือน/เทอม

5) **(คงอยู่) โหมดครู** (ถ้าเปิดหน้า): ความก้าวหน้ารายห้อง (เดือนนี้) + แชร์สรุปห้องเข้า LINE

6) **Safe DOM Helpers**  
   - ป้องกัน error เมื่อบางหน้าขาด element ด้วย `setText/setSrc/...`

---

## โครงสร้างโปรเจกต์

```
/ (root)
├─ index.html        # หน้า UI รวมทุกอย่าง (Tabs/Sections + Leaderboard + Report Hub)
├─ styles.css        # ธีม Kanit + card + bottom nav + responsive
├─ app.js            # Logic หลัก: fetch data, compute KPIs, charts, share LINE, PDF
└─ assets/
   ├─ crest.svg      # ตราโรงเรียน
   └─ avatar.svg     # Placeholder โปรไฟล์
```

> โปรเจกต์เป็น Static Site — เหมาะกับ GitHub Pages / Cloudflare Pages / Netlify

---

## การตั้งค่า & รัน

### 1) ตั้งค่า LIFF
แก้ใน `app.js`:
```js
const LIFF_ID = 'YOUR_LIFF_ID';
```
> ใช้ LIFF **Public** + เปิดสิทธิ์ `shareTargetPicker`

### 2) ตั้งค่า Data Source
- ธุรกรรม: `SHEET_TX = "https://opensheet.elk.sh/.../Sortรายการฝากและถอน"`  
- บัญชี: `SHEET_ACCOUNTS = "https://opensheet.elk.sh/...//บัญชี"`  
> ประกาศ/อัปเดตในส่วน GLOBAL ของโค้ดที่ดึงข้อมูล (อยู่ใน `app.js`)  
> แนะนำ: แยกชีต “aggregate” ที่คัดกรองแล้วเพื่อลดโหลดบนฝั่ง client

### 3) (ออปชัน) Supabase settings → โปรไฟล์ผู้ใช้
- ตาราง: `public.settings` (key/value)  
  - กำหนด key: `supabase_url`, `supabase_anon_key`
- ตาราง: `public.users` (อ่านโปรไฟล์จาก `line_user_id`)  
- โค้ดนี้ **อ่านอย่างเดียว** เพื่อนำมาแสดงในโปรไฟล์/มุมขวาบน

### 4) รันท้องถิ่น
เพราะมีการเรียกไฟล์ผ่าน `fetch` แนะนำรันผ่าน static server:
```bash
# Python
python3 -m http.server 8080
# หรือ
npx serve
```
แล้วเปิด `http://localhost:8080`

### 5) Deploy
- GitHub Pages: Settings → Pages → Deploy from branch → `main` (root)  
- หรือ Cloudflare/Netlify วางไฟล์ทั้งโฟลเดอร์

---

## หลักการคำนวณสำคัญ

### A) การแปลงวันที่ไทย → Date
```js
function parseThaiDate(s){
  // รองรับ '22/9/2568, 9:23:26' → คำนวณพ.ศ.→ค.ศ. (ลบ 543)
}
```

### B) เงื่อนไขช่วงเวลา
- สัปดาห์นี้: Monday–Sunday โดยประมาณ (ตั้งต้นวันจันทร์)
- เดือนนี้: first day → next month first day
- เทอมนี้: อ้างอิง `ปีการศึกษา` จากข้อมูลล่าสุด  
  - เทอม 1 (สมมติ): พ.ค.–ต.ค.  
  - เทอม 2 (สมมติ): พ.ย.–เม.ย. (ปีถัดไป)

> สามารถแก้ช่วงเวลาเทอมให้ตรงกับนโยบายโรงเรียนจริงใน `currentTermRange()`

### C) Leaderboard Scoring
```
score = depositCount + (depositCount >= baseline ? 0.5 : 0)
baseline = ค่าเฉลี่ย "จำนวนครั้งฝากต่อบัญชี" ในช่วงที่เลือก (เฉพาะบัญชีที่มีฝากในช่วงนั้น)
```

---

## แชร์ LINE (ใช้ได้ทุกเบราว์เซอร์)

แพตเทิร์นมาตรฐาน:
```js
await liff.init({ liffId: LIFF_ID });
if (!liff.isLoggedIn()) {
  // แจ้งผู้ใช้ → login
  liff.login({ redirectUri: location.href });
  return; // รอ reload
}
await liff.shareTargetPicker([flexMessage]);
```

- แนะนำให้ **ตรวจ login ก่อนทุกครั้ง** ที่ใช้ `shareTargetPicker`
- Flex ใช้ `bubble size: 'giga'` + ปุ่ม Footer `เปิด WDBank (LIFF)` เพื่อกลับเข้าหน้ารวม

---

## Report Hub → PDF

- ใช้ `Chart.js` วาดกราฟ (bar + line)  
- ใช้ `jsPDF` ดึงภาพจาก `<canvas>` ผ่าน `toDataURL()` แล้ว `addImage()` ลง A4

ข้อควรระวัง:
- บนมือถือบางรุ่นควรลดความละเอียดภาพกราฟ เพื่อไม่ให้ไฟล์ใหญ่เกิน
- ถ้ากราฟยาวหลายหน้า ใช้ `doc.addPage()` เพิ่มหน้า

---

## ความปลอดภัย & ความเป็นส่วนตัว

- ระบบนี้ **แสดงเฉพาะสถิติ** และ **mask เลขบัญชี** เป็น `1334 ••` ตามนโยบาย
- ข้อมูลส่วนบุคคล (LINE profile) ใช้เท่าที่จำเป็นเพื่อให้ UX ดีขึ้น (avatar/name) และ **เก็บให้น้อยที่สุด**
- การเชื่อมต่อ Supabase ใช้ **Anon Key** (อ่านอย่างเดียว) ตาม Role/Policy
- แนะนำให้กำหนด RLS (Row Level Security) ถ้าต้องรองรับการแก้ไข/เขียนในอนาคต

---

## แนวทางต่อยอด (สั้น ๆ)

- **Gamification:** badge/เลเวลต่อห้อง-ต่อบุคคล, รายการชาเลนจ์รายเดือน
- **แจ้งเตือนอัจฉริยะ:** แจ้งทุกศุกร์/ก่อนสิ้นเดือน, นักเรียนที่ “ใกล้ถึงเป้าหมาย”
- **การยืนยันสิทธิ์:** admin / teacher / parent ด้วย Supabase Auth + RLS
- **Offline-first:** service worker cache ข้อมูลล่าสุด + skeleton UI

---

## Troubleshooting

- `shareTargetPicker error: Need access_token...` → ต้อง `liff.login()` ก่อน
- Selector error แปลก ๆ เช่น `html:comments(...)` หรือ `#?#script` มาจาก **ปลั๊กอินเบราว์เซอร์** → ไม่เกี่ยวกับโค้ดเรา
- ข้อมูลโหลดช้า → ตรวจปลายทาง `opensheet.elk.sh` / จำกัดจำนวน record / ทำหน้า aggregate

---

## License
MIT (ระบุได้ตามนโยบายโรงเรียน)
