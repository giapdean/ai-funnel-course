---
name: Khóa Học Xây Dựng Ai Funnel - Technical Planning
date: 2026-02-21
version: 1.0.0
---

# Phase 2: Technical Planning

## 1. Cấu trúc thư mục (Directory Structure)
Dự án được khởi tạo tại `D:\App\GAS Kit test` với cấu trúc chuẩn:
- `Source_Code/`: Chứa mã nguồn HTML/CSS/JS (Frontend) và file `.gs` (Backend).
- `Automation_Tools/`: Chứa các script tự động hóa (nếu có sau này).
- `MCP/`: Chứa cấu hình MCP (nếu có mở rộng).

## 2. Thiết kế Cơ sở dữ liệu (Database Design) - Google Sheets
Tạo 1 file Google Sheets với các tab sau:
- **Tab `Users` (Học viên):**
  - Cột: `ID`, `Timestamp`, `FullName`, `Email`, `Phone`, `RefCode` (Mã giới thiệu của user này), `ReferredBy` (Mã của người giới thiệu user này), `Status` (Pending/Paid/Free), `CourseLink` (Link Zoom).
- **Tab `Transactions` (Giao dịch):**
  - Cột: `TxnID`, `Timestamp`, `Email`, `Amount`, `SePayTxnCode`, `Status`.

## 3. Kiến trúc Frontend (Landing Page)
- **Công nghệ:** HTML5, CSS3 (Vanilla), JavaScript.
- **UI/UX Pattern:** Sử dụng Dark Mode, Glassmorphism, phong cách Premium (theo chuẩn skill UX-UI).
- **Các Section chính:**
  - Hero Section: Tiêu đề lôi cuốn, Video/Ảnh minh họa, Nút "Đăng ký ngay".
  - Pain points & Solutions: Trình bày vấn đề của Marketer và giải pháp từ khóa học.
  - Showcase: Các ví dụ thực tế (Viral game, vòng quay may mắn) làm bằng AI/GAS.
  - Pricing & Registration Form: Form thu thập `FullName`, `Email`, `Phone`. Tích hợp logic xử lý logic phân loại thanh toán (3.000.000đ vs Share 2 người).

## 4. Kiến trúc Backend (Google Apps Script)
- **Công nghệ:** Google Apps Script (GAS) triển khai Web App.
- **Endpoints (doPost):**
  - `action=register`: Nhận data từ Form Đăng ký, tạo record trạng thái `Pending`. Trả về `RefCode` hoặc hướng dẫn thanh toán.
  - `action=sepay_webhook`: Nhận Webhook từ SePay khi có giao dịch thành công. Kiểm tra `Amount` và `Email` trong nội dung chuyển khoản để update trạng thái `Paid` trên Sheet `Users`.
- **Ghi nhận Chia sẻ (Referral Tracking - Frontend Vercel, Backend GAS):**
  - Khi User A đăng ký thành công, GAS sinh ra một Unique `RefCode` (VD: mã ngẫu nhiên 6 ký tự hoặc hash từ Email).
  - Vercel Frontend nhận response từ GAS POST `/register` và hiển thị màn hình Success cho User A với link chia sẻ: `https://[Domain_Vercel]?ref=[RefCode_Cua_A]`.
  - **Cơ chế Tracking khi User B truy cập:**
    1. Khi User B (người được mời) click link `https://[Domain_Vercel]?ref=[RefCode_Cua_A]`.
    2. Frontend (chạy trên trình duyệt của B) sẽ đọc tham số URL `?ref=` bằng JavaScript (`new URLSearchParams(window.location.search)`).
    3. Frontend tự động lưu mã `RefCode_Cua_A` vào `localStorage` của trình duyệt hoặc điền sẵn vào thẻ `<input type="hidden" name="ReferredBy">` trong Form đăng ký.
    4. Ngay cả khi User B lướt các trang khác trên Vercel rồi mới quay lại trang đăng ký, thông tin `ReferredBy` vẫn được giữ ở `localStorage`.
    5. Khi User B bấm Submit Form, Frontend Vercel đính kèm trường `ReferredBy: RefCode_Cua_A` gửi POST request qua API của GAS.
    6. Nhờ cơ chế lưu LocalStorage ở Client-side, việc tách bạch Frontend (Vercel) và Backend (GAS) hoàn toàn khả thi và cực kỳ ổn định.

- **Background Jobs (Time-driven triggers) / Webhook (Realtime triggers):**
  - **Logic Đếm Referral:** Mỗi khi có 1 user mới đăng ký có chứa `ReferredBy` là `RefCode_Cua_A`.
  - Hệ thống tự động filter Sheet `Users` để đếm xem có bao nhiêu người có `ReferredBy == RefCode_Cua_A` và có trang thái `Pending` hoặc `Paid`.
  - Nếu `Count >= 2`:
    - Cập nhật dòng của User A: `Status` = `Free`.
    - Gọi hàm `sendEmailToEligibleUser()` để gửi Email chúc mừng, chứa link Zoom và bộ GAS Kit.
- **Email Service:**
  - `GmailApp.sendEmail()` để gửi email chào mừng và link khóa học kèm bộ GAS Kit.

## 5. Tích hợp Thanh toán (SePay Integration)
- **Mô hình:** Async Webhook.
- **Luồng:**
  1. User chọn thanh toán -> Frontend hiển thị mã QR Code chứa nội dung chuyển khoản (VD: `AIFUNNEL [Email]`).
  2. User quét mã chuyển tiền.
  3. SePay nhận biến động số dư -> Gửi POST request tới GAS Web App URL.
  4. GAS xử lý webhook, update Sheet, gửi Email hoàn tất.

## 6. Luồng Xử Lý Backend Chi Tiết (Flow Chart)
1. **POST /register**:
   - Parse Payload (Name, Email, Phone, ReferredBy).
   - Generate `RefCode` cho User mới.
   - Insert vào Sheet `Users`. Trạng thái ban đầu: `Pending`.
   - Nếu `ReferredBy` có dữ liệu: Trigger hàm đếm Referral cho người giới thiệu.
   - Trả về JSON chứa `RefCode` và `CheckoutURL` hoặc Link giao diện chứa QR Code Sepay.
2. **Hàm Đếm Referral**:
   - `SELECT COUNT(*) FROM Users WHERE ReferredBy = incoming_ReferredBy`.
   - `IF COUNT >= 2`: Lấy thông tin người giới thiệu -> Update `Status = Free` -> Gửi Email.
3. **POST /sepay_webhook**:
   - Parse `Amount`, `transferContent` (chứa Email hoặc Phone).
   - Cập nhật `Transactions` log.
   - Tự động thay đổi `Status = Paid` của User trong tab `Users`.
   - Gửi Email xác nhận kèm quà tặng / link Zoom.

## 7. Các bước triển khai (Implementation Plan)
1. Thống nhất và lấy các thông tin môi trường (SePay API/Bank info, Google Sheet URL).
2. Code Frontend Layout & Styling (CSS/UI).
3. Code chức năng Frontend (JS gọi API).
4. Code Backend (GAS) - Xử lý Registration & Webhook.
5. Code tính năng Referral và Trigger Email.
6. Cấu hình Deploy (Sử dụng `clasp` hoặc copy code lên GAS editor).
7. Test end-to-end.

## 8. Known Issues & Bug Prevention (Cơ chế phòng ngừa Lỗi dựa trên Database)
Để đảm bảo sự rạch ròi và tính ổn định tuyệt đối giữa Frontend (Vercel) và Backend (GAS), hệ thống đã thiết kế các cơ chế phòng tránh lỗi kinh điển như sau:

- **CORS Error (Bug #14 & #15):** 
  - *Vấn đề:* Trình duyệt block request từ Vercel sang GAS do khác nguồn (Cross-Origin), hoặc backend lỗi ngầm không trả về header cho phép.
  - *Giải pháp:* GAS doPost sẽ luôn bọc logic trong global `try...catch`. Bất kể lỗi hay thành công, GAS luôn trả về format chuẩn kèm header `Access-Control-Allow-Origin: *`. Frontend sẽ sử dụng phương thức `text/plain` hoặc bọc data trong `JSON.stringify()` để tránh preflight request OPTIONS bị Google block.
- **SePay Webhook Mismatch (Bug #19):**
  - *Vấn đề:* Khách hàng nhập nội dung chuyển khoản sai (VD: thừa khoảng trắng, chữ hoa/chữ thường).
  - *Giải pháp:* Mã nạp tiền (Payment Code) sinh ra sẽ là chuỗi dính liền (VD: `AIFUNNELA123BC`). Cả Backend GAS khi dò RegEx và lúc quét webhook đều sẽ ép kiểu `.toUpperCase()` và xóa sạch khoảng trắng `.replace(/\s/g, '')` trước khi so sánh.
- **Form Data & Object Parsing (Bug #9):**
  - *Vấn đề:* Fetch API từ Frontend Vercel biến Data thành chuỗi `[object Object]` khi gửi tới GAS.
  - *Giải pháp:* Frontend gửi body dạng chuỗi nguyên thủy `JSON.stringify(payload)`. GAS backend sau khi nhận `e.postData.contents` sẽ tự parse ngược lại `JSON.parse()`.
- **Deploy URL Không Cố Định (Bug #18 & #20):**
  - *Vấn đề:* Mỗi lần cập nhật code GAS, App URL bị thay đổi làm Frontend Vercel bị "chết API".
  - *Giải pháp:* Sẽ dùng cơ chế Deployment ID cố định trên GAS (Overwrite phiên bản cũ) thay vì tạo mới web application. Đảm bảo URL API là 1 đường link duy nhất từ đầu đến cuối dự án, Vercel chỉ cần config Environment Variable 1 lần.
