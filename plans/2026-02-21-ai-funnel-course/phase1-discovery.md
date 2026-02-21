---
name: Khóa Học Xây Dựng Ai Funnel - Product Discovery
date: 2026-02-21
version: 1.0.0
---

# Phase 1: Product Discovery

## 1. Vấn đề & Đối tượng (Problem & Audience)
- **Khách hàng mục tiêu:** Marketer và Quản lý (Manager).
- **Vấn đề (Pain points):** Họ có nhiều ý tưởng cho các chiến dịch Marketing (VD: Chiến dịch Viral, Share nhận quà, Quay số trúng thưởng) nhưng gặp rào cản lớn về năng lực kỹ thuật (không rành code, không biết cách setup hệ thống).
- **Giải pháp (Solution):** Khóa học sẽ hướng dẫn (showcase) cách ứng dụng AI, Google Apps Script (GAS) và công cụ Antigravity để một người duy nhất cũng có thể tự tạo Landing Page, làm Game Marketing và đo lường kết quả chiến dịch.
- **Giá trị tăng thêm (Bonus):** Tặng kèm bộ "GAS Kit" (chứa video hướng dẫn + bộ skills Antigravity đã đúc kết).

## 2. Mô hình Sản phẩm
- **Loại hình khóa học:** Học trực tuyến qua Zoom (Zoom Online).
- **Phân khúc Giá:**
  - **Miễn phí (Free):** Dành cho học viên tham gia chương trình Referral (Chỉ cần Share Landing Page cho 2 người bạn đăng ký thành công).
  - **Trả phí (Paid):** 3.000.000 VNĐ dành cho người đăng ký mua thẳng không qua Referral.

## 3. Cấu trúc Hệ thống & User Flow (MVP)
Cấu trúc hệ thống ở phiên bản MVP tập trung vào việc tự động hóa quá trình Tuyển sinh và Bán khóa học.

### User Flow (Luồng người dùng):
1. Khách hàng truy cập **Landing Page** giới thiệu khóa học.
2. Khách hàng điền **Form Đăng ký**.
3. **Phân nhánh kịch bản:**
   - **Kịch bản A (Trả phí):** Khách hàng chọn thanh toán 3.000.000đ → Chuyển tới màn hình tạo mã thanh toán QR Code (SePay) → Hệ thống xác nhận tự động khi nhận được tiền.
   - **Kịch bản B (Referral/Viral):** Khách hàng nhận được 1 Link Affiliate/Share tracking → Chia sẻ cho 2 người bạn. Khi đủ 2 người đăng ký qua link, hệ thống ghi nhận và cấp quyền miễn phí.
4. Hệ thống ghi nhận dữ liệu vào **Google Sheets** (Database).
5. Hệ thống gửi tự động **Email Xác nhận** (nội dung chứa quà tặng bộ GAS Kit, link Zoom và thông tin ngày giờ học).
6. Khách hàng tham gia Zoom vào ngày tổ chức khóa học.

## 4. Đặc tả Kỹ thuật (Technical Specs - High level)
- **Frontend:** Thiết kế Landing Page bằng HTML/CSS/JS (tích hợp chuẩn UX/UI theo skill hiện có).
- **Backend:** Google Apps Script (GAS) xử lý logic form, gửi email tự động và nhận Webhook.
- **Database:** Google Sheets.
- **Thanh toán:** Tích hợp Webhook của SePay để nhận biến động số dư và xác nhận thanh toán tự động (Real-time tracking).
- **Hệ thống Email:** Gmail App kết hợp với GAS.
- **Tracking/Referral:** Cần thuật toán sinh mã giới thiệu (Referral Code / Ref ID) để track số người được mời từ mỗi User.
