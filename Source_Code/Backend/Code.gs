// Dự án: Khóa Học Xây Dựng Ai Funnel
// Lên thiết kế bởi Antigravity

const CONFIG = {
  SHEET_ID: "CHUA_CO", // Sẽ thay thế bằng link Google Sheet của User
  SEPAY_TOKEN: "CHUA_CO", // Thay thế bằng API Token của SePay
};

function doPost(e) {
  // Hàm nhận Webhook hoặc Đăng ký
}

function doGet(e) {
  // Hàm hiển thị trang đăng ký hoặc xác nhận Backend sống
  return ContentService.createTextOutput("Backend Active");
}
