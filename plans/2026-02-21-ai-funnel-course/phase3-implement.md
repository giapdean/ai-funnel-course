---
name: Khóa Học Xây Dựng Ai Funnel - Implementation Plan
date: 2026-02-21
version: 1.0.0
---

# Phase 3: Implementation Plan

Dự án đã được thiết kế kiến trúc chuẩn. Dưới đây là lộ trình Code cụ thể (Step by step). Cần User cung cấp Google Sheet Link và SePay API (nếu có) để bắt đầu.

## Step 1: Chuẩn bị Môi trường (Environment Setup)
- Khởi tạo File Google Sheet làm cơ sở dữ liệu (`Users` và `Transactions`).
- Khởi tạo File Google Apps Script (Backend).
- Kết nối mã lệnh với Repo / Tích hợp lệnh `clasp push` nếu sử dụng quản lý Code cục bộ.
- Nhúng các Configs (Spreadsheet ID, SePay API Token...).

## Step 2: Xây dụng Frontend (Vercel)
- Thiết lập cấu trúc File HTML (`index.html`), CSS (`styles.css`), JS (`app.js`).
- **UI/UX:** Gọi `@[/UX-UI]` để nhúng Design System (Dark Mode, Glassmorphism, Gradient).
- **Layout:** Thiết kế Hero Section, Đăng ký Form, Mockup "Ai Funnel" Features.
- **Form Logic (app.js):**
  - Xử lý Tracking Referral (đọc URL query `?ref=...` và lưu vào `localStorage`).
  - Lấy dữ liệu Ẩn (Hidden Input) gửi sang GAS qua Fetch API.

## Step 3: Xây dựng Backend (Google Apps Script)
- **Hàm `doPost(e)`:** Xử lý điều hướng Action (Register hoặc Webhook).
- **Logic Insert User (`action=register`):** Tạo `RefCode` duy nhất, thêm thông tin User mới với status `Pending`.
- **Logic Webhook SePay (`action=sepay_webhook`):** Map tiền, thay đổi trạng thái user thành `Paid`.
- **Cơ chế Send Email (`MailApp`/`GmailApp`):** Tự động gửi Email báo danh thành công kèm link Zoom.
- **Trigger Check Referral:** Hàm check đếm số lượng giới thiệu (nếu >=2) để chuyển trạng thái thành `Free` và bắn Email.

## Step 4: Triển khai & Testing
- Deploy GAS (Lấy Web App URL cố định).
- Kết nối Frontend (App.js) với Web App URL trên.
- Run test:
  - Test đăng ký bình thường.
  - Test thanh toán (Giả lập Webhook).
  - Test Referral (Lấy refcode click thử, xem localStorage và Google Sheet lưu vết đúng không).
