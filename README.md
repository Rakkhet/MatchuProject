# Glowmore — ร้านขายมัทฉะออนไลน์

โปรเจกต์นี้เป็นเว็บแอปพลิเคชัน e-commerce สำหรับขายมัทฉะและอุปกรณ์ชงมัทฉะ พัฒนาด้วย React (Frontend) และ Express + PostgreSQL (Backend)

---

## Tech Stack

| ส่วน | เทคโนโลยี |
|------|-----------|
| Frontend | React, Vite |
| Backend | Node.js, Express |
| Database | PostgreSQL, Prisma ORM |
| การชำระเงิน | PromptPay QR Code |

---

## โครงสร้างโปรเจกต์

```
MatchuProject/
├── my-app/          # Frontend (React + Vite)
│   ├── src/
│   │   ├── pages/       # หน้าต่างๆ ของเว็บ
│   │   ├── components/  # UI components
│   │   └── lib/         # API client และ utility functions
│   └── public/          # รูปภาพและวิดีโอ
└── backend/         # Backend (Express)
    ├── index.js         # API server หลัก
    └── prisma/          # Database schema และ migrations
```

---

## ฟีเจอร์หลัก

- **หน้าร้าน** — แสดงสินค้ามัทฉะและอุปกรณ์ พร้อม background video
- **Shop Matcha / Tools** — เลือกซื้อสินค้าพร้อมระบบ filter
- **Starter Kit** — เลือกซื้อชุดอุปกรณ์พร้อมมัทฉะในแพ็กเดียว
- **ตะกร้าสินค้า** — เพิ่ม/ลบสินค้า sync กับ server อัตโนมัติ
- **Checkout** — กรอกที่อยู่จัดส่งและชำระผ่าน PromptPay QR พร้อมอัปโหลดหลักฐานการโอน
- **ติดตามออเดอร์** — ดูสถานะออเดอร์ตั้งแต่รอตรวจสอบ → จัดส่ง → ได้รับสินค้า
- **รีวิว** — ลูกค้าที่ชำระเงินแล้วสามารถเขียนรีวิวได้
- **Admin Dashboard** — จัดการออเดอร์ อัปเดตสถานะ และจัดการสินค้า

---

## การติดตั้งและรันโปรเจกต์

### ข้อกำหนดเบื้องต้น

- Node.js >= 18
- PostgreSQL

### 1. ติดตั้ง Dependencies

```bash
# Frontend
cd my-app
npm install

# Backend
cd ../backend
npm install
```

### 2. ตั้งค่า Environment

สร้างไฟล์ `backend/.env` แล้วใส่ข้อมูลดังนี้:

```env
PORT=4000
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DATABASE_NAME"
```

### 3. รัน Database Migration

```bash
cd backend
npx prisma migrate deploy
```

### 4. รันโปรเจกต์

```bash
# Backend (port 4000)
cd backend
node index.js

# Frontend (port 5173)
cd my-app
npm run dev
```

เปิดเบราว์เซอร์ที่ `http://localhost:5173`

---

## บัญชี Admin (สำหรับทดสอบ)

| ฟิลด์ | ค่า |
|-------|-----|
| Username | `adminowen` |
| Password | `1234` |

---

โปรเจกต์นี้เป็นส่วนหนึ่งของวิชา CSC350 Web Programming
