// ============================================================
// Dự án: Khóa Học Xây Dựng Ai Funnel
// Backend: Google Apps Script
// ============================================================

const CONFIG = {
  SPREADSHEET_ID: "1mR7vS6nFQ-8A2v8Y3eXGBWJPB1ukm0GXTFPjs3qmOgs",
  SEPAY_TOKEN: "0651316513131331",
  COURSE_DATE: "2026-03-15",
  ZOOM_LINK: "", // Điền sau khi có link Zoom
  GAS_KIT_LINK: "", // Điền sau khi có link GAS Kit
};

// ============================================================
// SETUP: Chạy 1 lần để tạo Google Sheet Database
// ============================================================
function setupSpreadsheet() {
  const ss = SpreadsheetApp.create("Ai Funnel Course - Database");
  
  // Tab Users
  const usersSheet = ss.getSheets()[0];
  usersSheet.setName("Users");
  usersSheet.appendRow([
    "ID", "Timestamp", "FullName", "Email", "Phone",
    "RefCode", "ReferredBy", "Status", "EmailSent"
  ]);
  usersSheet.setFrozenRows(1);
  
  // Tab Transactions
  const txSheet = ss.insertSheet("Transactions");
  txSheet.appendRow([
    "TxnID", "Timestamp", "Email", "Amount", "SePayTxnCode", "Status"
  ]);
  txSheet.setFrozenRows(1);
  
  Logger.log("✅ Spreadsheet created: " + ss.getUrl());
  Logger.log("📋 Spreadsheet ID: " + ss.getId());
  Logger.log("⚠️ HÃY COPY Spreadsheet ID này vào CONFIG.SPREADSHEET_ID ở Code.gs!");
  
  return ss.getId();
}

// ============================================================
// UTILITY
// ============================================================
function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return ss.getSheetByName(sheetName);
}

function generateRefCode(email) {
  // ⚡ LUÔN dùng email-based code (đồng bộ với frontend index.html)
  // Công thức: lấy prefix email (trước @), viết hoa, tối đa 6 ký tự, thay ký tự đặc biệt bằng X
  if (!email) {
    Logger.log("⚠️ generateRefCode: email is empty! Returning fallback 'NOMAIL'");
    return "NOMAIL";
  }
  return email.split('@')[0].toUpperCase().substring(0, 6).replace(/[^A-Z0-9]/g, "X");
}

function generatePaymentCode(email) {
  // Format: AIFUNNEL + RefCode -- dùng toUpperCase để tránh mismatch
  const refCode = email.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "X");
  return "AIFUNNEL" + refCode + Date.now().toString().slice(-4);
}

// ============================================================
// MAIN ENDPOINT
// ============================================================
function doPost(e) {
  // ⚡ Luôn bọc trong try-catch để tránh CORS Error (Bug #14, #15)
  try {
    const payload = JSON.parse(e.postData.contents); // (Bug #9 fix)
    const action = payload.action;

    if (action === "register") {
      return handleRegister(payload);
    } else if (action === "sepay_webhook") {
      return handleSepayWebhook(payload);
    } else {
      return respond({ success: false, error: "Unknown action" });
    }
  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ status: "active", project: "Ai Funnel Course Backend" })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// REGISTER HANDLER
// ============================================================
function handleRegister(data) {
  const sheet = getSheet("Users");
  const email = (data.email || "").trim().toLowerCase(); // (Bug #6 fix)
  const name = (data.name || "").trim();
  const phone = (data.phone || "").trim();
  const referredBy = (data.referredBy || "").trim().toUpperCase();

  // Tạo RefCode và PaymentCode
  const refCode = generateRefCode(email);
  const paymentCode = generatePaymentCode(email);
  const id = Utilities.getUuid();
  const timestamp = new Date();

  // Ghi vào Sheet
  sheet.appendRow([
    id, timestamp, name, email, phone,
    refCode, referredBy, "Pending", false
  ]);

  // Nếu được giới thiệu, check Referral
  if (referredBy) {
    checkAndGrantFreeAccess(referredBy);
  }

  return respond({
    success: true,
    refCode: refCode,
    paymentCode: paymentCode,
    message: "Đăng ký thành công!"
  });
}

// ============================================================
// REFERRAL: Check và cấp quyền Free
// ============================================================
function checkAndGrantFreeAccess(referrerRefCode) {
  const sheet = getSheet("Users");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const refCodeCol = headers.indexOf("RefCode");
  const referredByCol = headers.indexOf("ReferredBy");
  const statusCol = headers.indexOf("Status");
  const emailCol = headers.indexOf("Email");
  const emailSentCol = headers.indexOf("EmailSent");
  const nameCol = headers.indexOf("FullName");

  // Đếm số người được giới thiệu bởi referrerRefCode
  let count = 0;
  let referrerRow = -1;
  let referrerData = null;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Tìm hàng của người giới thiệu
    if (row[refCodeCol] === referrerRefCode) {
      referrerRow = i + 1;
      referrerData = row;
    }
    // Đếm số người được giới thiệu (và đã đăng ký thật - Pending/Paid)
    const rb = (row[referredByCol] || "").toUpperCase();
    const st = (row[statusCol] || "").toLowerCase();
    if (rb === referrerRefCode && (st === "pending" || st === "paid" || st === "free")) {
      count++;
    }
  }

  // Nếu đủ 2 người và người giới thiệu vẫn còn Pending -> cấp Free
  if (count >= 2 && referrerRow > 0 && referrerData) {
    const currentStatus = (referrerData[statusCol] || "").toLowerCase();
    // Chỉ upgrade nếu đang Pending (tránh override Paid)
    if (currentStatus === "pending") {
      sheet.getRange(referrerRow, statusCol + 1).setValue("Free");
      // Gửi email nếu chưa gửi
      if (!referrerData[emailSentCol]) {
        sendCourseEmail(referrerData[emailCol], referrerData[nameCol], "free");
        sheet.getRange(referrerRow, emailSentCol + 1).setValue(true);
        Logger.log("✅ Cấp Free cho: " + referrerData[emailCol]);
      }
    }
  }
}

// ============================================================
// SEPAY WEBHOOK HANDLER
// ============================================================
function handleSepayWebhook(data) {
  // Normalize để tránh Bug #19 (khoảng trắng, hoa thường)
  const transferContent = (data.transferContent || "").toUpperCase().replace(/\s/g, "");
  const amount = parseFloat(data.transferAmount || 0);

  Logger.log("📩 Webhook received: " + transferContent + " | " + amount);

  // Ghi Transaction log
  const txSheet = getSheet("Transactions");
  const txId = Utilities.getUuid();
  txSheet.appendRow([txId, new Date(), "", amount, transferContent, "received"]);

  // Tìm user có PaymentCode khớp trong nội dung chuyển khoản
  if (amount >= 3000000 && transferContent.includes("AIFUNNEL")) {
    const userSheet = getSheet("Users");
    const data2 = userSheet.getDataRange().getValues();
    const headers = data2[0];
    const emailCol = headers.indexOf("Email");
    const statusCol = headers.indexOf("Status");
    const nameCol = headers.indexOf("FullName");
    const emailSentCol = headers.indexOf("EmailSent");

    // Tra cứu user có email trong content (tạm thời dùng cách kiểm tra đơn giản)
    for (let i = 1; i < data2.length; i++) {
      const row = data2[i];
      const email = (row[emailCol] || "").toLowerCase();
      const emailNorm = email.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "X");
      const expectedCode = "AIFUNNEL" + emailNorm;
      
      if (transferContent.includes(expectedCode) && row[statusCol] === "Pending") {
        userSheet.getRange(i + 1, statusCol + 1).setValue("Paid");
        // Cập nhật txSheet với email
        txSheet.getRange(txSheet.getLastRow(), emailCol + 1).setValue(email);
        // Gửi email xác nhận
        if (!row[emailSentCol]) {
          sendCourseEmail(email, row[nameCol], "paid");
          userSheet.getRange(i + 1, emailSentCol + 1).setValue(true);
        }
        Logger.log("✅ Thanh toán OK: " + email);
        break;
      }
    }
  }

  return respond({ success: true });
}

// ============================================================
// EMAIL SERVICE
// ============================================================
function sendCourseEmail(toEmail, name, type) {
  const subject = type === "paid"
    ? "🎉 Xác nhận Đăng ký Khóa Học Xây Dựng Ai Funnel!"
    : "🎁 Bạn đã nhận được Khóa Học Ai Funnel Miễn Phí!";

  const body = `
Xin chào ${name},

${type === "paid"
  ? "Cảm ơn bạn đã đăng ký Khóa Học Xây Dựng Ai Funnel!"
  : "Chúc mừng! Bạn đã đủ điều kiện nhận Khóa Học Ai Funnel MIỄN PHÍ nhờ chương trình giới thiệu!"}

📅 Ngày học: ${CONFIG.COURSE_DATE}
📹 Link Zoom: ${CONFIG.ZOOM_LINK || "[Sắp cập nhật]"}
🎁 Bộ GAS Kit của bạn: ${CONFIG.GAS_KIT_LINK || "[Sắp cập nhật]"}

Trân trọng,
Team Ai Funnel
  `.trim();

  try {
    GmailApp.sendEmail(toEmail, subject, body);
    Logger.log("📧 Email gửi thành công tới: " + toEmail);
  } catch (err) {
    Logger.log("⚠️ Lỗi gửi email: " + err.message);
  }
}

// ============================================================
// HELPER
// ============================================================
function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
