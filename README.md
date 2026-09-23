# Sati Shift & OT Audit

ระบบจัดตารางเวรและคำนวณเงินค่าตอบแทน (OT) รายวันและรายเดือน สำหรับแพทย์ พยาบาล ผู้ช่วยพยาบาล และห้องผ่าตัด พร้อมสรุปแดชบอร์ดงบประมาณ

แอปนี้ทำงานฝั่ง browser ทั้งหมด (React + Vite) และเก็บข้อมูลไว้ใน `localStorage` ของเครื่อง ไม่ต้องใช้ API key หรือบริการภายนอกใด ๆ ในการรัน

## Run Locally

**Prerequisites:** Node.js (หรือ Bun)

1. ติดตั้ง dependencies:

   ```bash
   npm install
   ```

2. รันแอป:

   ```bash
   npm run dev
   ```

   เปิดที่ http://localhost:3000

## Scripts

- `npm run dev` — รัน dev server (Vite) ที่พอร์ต 3000
- `npm run build` — build โปรดักชันไปที่ `dist/`
- `npm run preview` — พรีวิว build ที่ build แล้ว
- `npm run lint` — ตรวจชนิดข้อมูลด้วย TypeScript (`tsc --noEmit`)
