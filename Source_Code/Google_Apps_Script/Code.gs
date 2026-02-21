// ============================================================
// Dự án: Khóa Học Xây Dựng Ai Funnel
// Backend: Google Apps Script
// ============================================================

const CONFIG = {
  SPREADSHEET_ID: "1mR7vS6nFQ-8A2v8Y3eXGBWJPB1ukm0GXTFPjs3qmOgs",
  SEPAY_TOKEN: "0651316513131331",
  COURSE_DATE: "2026-03-15",
  ZOOM_LINK: "",
  GAS_KIT_LINK: "",
  // Facebook Scraper RapidAPI
  RAPIDAPI_KEY: "19e1e36dcemshb888996018daff6p101216jsn49b3e583a1a7",
  RAPIDAPI_HOST: "facebook-scraper3.p.rapidapi.com",
  // GAS Kit Drive Folder
  GAS_KIT_FOLDER_ID: "1N2_33FMygdC_o4WXNfdO9-PdvFMyIivg",
  GAS_KIT_FOLDER_URL: "https://drive.google.com/drive/folders/1N2_33FMygdC_o4WXNfdO9-PdvFMyIivg",
  MIN_FOLLOWERS: 1000,
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

function generateRefCode(phone) {
  // ⚡ Dùng số điện thoại làm RefCode (đồng bộ với frontend index.html)
  // Công thức: chỉ giữ số, lấy 6 chữ số cuối
  if (!phone) {
    Logger.log("⚠️ generateRefCode: phone is empty!");
    return "000000";
  }
  return phone.replace(/\D/g, "").slice(-6);
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
    } else if (action === "verify_fb_share") {
      return handleVerifyFbShare(payload);
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
  const refCode = generateRefCode(phone);
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

  // ⚡ Luôn cast sang String vì Google Sheets trả về Number cho RefCode toàn số
  const refCodeTarget = String(referrerRefCode).trim();
  Logger.log("🔍 Checking referral for RefCode: " + refCodeTarget);

  // Đếm số người được giới thiệu bởi referrerRefCode
  let count = 0;
  let referrerRow = -1;
  let referrerData = null;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // ⚡ Cast sang String trước khi so sánh (fix Bug: Number !== String)
    const rowRefCode = String(row[refCodeCol] || "").trim();
    const rowReferredBy = String(row[referredByCol] || "").trim();
    const rowStatus = String(row[statusCol] || "").trim().toLowerCase();

    // Tìm hàng của người giới thiệu
    if (rowRefCode === refCodeTarget) {
      referrerRow = i + 1;
      referrerData = row;
    }
    // Đếm số người được giới thiệu (và đã đăng ký thật - Pending/Paid/Free)
    if (rowReferredBy === refCodeTarget && (rowStatus === "pending" || rowStatus === "paid" || rowStatus === "free")) {
      count++;
    }
  }

  Logger.log("📊 Referral count for " + refCodeTarget + ": " + count + " | Referrer found at row: " + referrerRow);

  if (!referrerData || referrerRow < 0) return;

  const currentStatus = String(referrerData[statusCol] || "").trim().toLowerCase();

  // 🔔 Khi có đúng 1 người giới thiệu -> gửi email thông báo tiến độ
  if (count === 1 && currentStatus === "pending") {
    sendReferralProgressEmail(referrerData[emailCol], referrerData[nameCol], count, refCodeTarget);
    Logger.log("📧 Gửi email thông báo 1 referral cho: " + referrerData[emailCol]);
  }

  // 🎉 Nếu đủ 2 người và người giới thiệu vẫn còn Pending -> cấp Free
  if (count >= 2 && currentStatus === "pending") {
    sheet.getRange(referrerRow, statusCol + 1).setValue("Free");
    // Gửi email nếu chưa gửi
    if (!referrerData[emailSentCol]) {
      sendCourseEmail(referrerData[emailCol], referrerData[nameCol], "free");
      sheet.getRange(referrerRow, emailSentCol + 1).setValue(true);
      Logger.log("✅ Cấp Free cho: " + referrerData[emailCol]);
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
// GAS KIT GAME: Facebook Share Verification
// ============================================================

/**
 * Setup: Tạo tab GASKit trong Spreadsheet (chạy 1 lần)
 */
function setupGASKitSheet() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var existing = ss.getSheetByName("GASKit");
  if (existing) {
    Logger.log("⚠️ Tab GASKit đã tồn tại");
    return;
  }
  var sheet = ss.insertSheet("GASKit");
  sheet.appendRow(["ID", "Timestamp", "Email", "PostURL", "AuthorName", "AuthorURL", "Followers", "Status"]);
  sheet.setFrozenRows(1);
  Logger.log("✅ Tạo tab GASKit thành công");
}

/**
 * Handler: Xác thực bài viết Facebook và cấp GAS Kit
 */
function handleVerifyFbShare(data) {
  var email = (data.email || "").trim().toLowerCase();
  var postUrl = (data.postUrl || "").trim();

  if (!email || !postUrl) {
    return respond({ success: false, error: "Vui lòng nhập Email và Link bài viết." });
  }

  // ⚡ Chống duplicate: check email đã nhận chưa
  var sheet = getSheet("GASKit");
  if (!sheet) {
    // Tự tạo tab nếu chưa có
    setupGASKitSheet();
    sheet = getSheet("GASKit");
  }
  var existingData = sheet.getDataRange().getValues();
  for (var i = 1; i < existingData.length; i++) {
    var rowEmail = String(existingData[i][2] || "").trim().toLowerCase();
    var rowStatus = String(existingData[i][7] || "").trim().toLowerCase();
    if (rowEmail === email && rowStatus === "approved") {
      return respond({ success: false, error: "Email này đã nhận GAS Kit rồi! Mỗi email chỉ được nhận 1 lần." });
    }
  }

  // Step 1: Gọi API lấy nội dung bài viết
  var postResult;
  try {
    var postApiUrl = "https://" + CONFIG.RAPIDAPI_HOST + "/post?post_url=" + encodeURIComponent(postUrl);
    var postResponse = UrlFetchApp.fetch(postApiUrl, {
      method: "GET",
      headers: {
        "x-rapidapi-host": CONFIG.RAPIDAPI_HOST,
        "x-rapidapi-key": CONFIG.RAPIDAPI_KEY
      },
      muteHttpExceptions: true
    });
    postResult = JSON.parse(postResponse.getContentText());
  } catch (err) {
    Logger.log("⚠️ API post error: " + err.message);
    return respond({ success: false, error: "Không thể kiểm tra bài viết. Vui lòng kiểm tra link." });
  }

  if (!postResult || !postResult.results || !postResult.results.message) {
    return respond({ success: false, error: "Không tìm thấy bài viết hoặc bài viết không công khai." });
  }

  // Check hashtag #aifunnel (case-insensitive)
  var postMessage = (postResult.results.message || "").toLowerCase();
  if (postMessage.indexOf("#aifunnel") === -1) {
    return respond({ success: false, error: "Bài viết chưa có hashtag #aifunnel. Vui lòng thêm hashtag và thử lại." });
  }

  // Lấy thông tin tác giả
  var authorName = (postResult.results.author && postResult.results.author.name) || "Unknown";
  var authorUrl = (postResult.results.author && postResult.results.author.url) || "";

  if (!authorUrl) {
    return respond({ success: false, error: "Không lấy được thông tin tác giả. Vui lòng kiểm tra bài viết." });
  }

  // Step 2: Gọi API kiểm tra followers
  var pageResult;
  try {
    var pageApiUrl = "https://" + CONFIG.RAPIDAPI_HOST + "/page/details?url=" + encodeURIComponent(authorUrl);
    var pageResponse = UrlFetchApp.fetch(pageApiUrl, {
      method: "GET",
      headers: {
        "x-rapidapi-host": CONFIG.RAPIDAPI_HOST,
        "x-rapidapi-key": CONFIG.RAPIDAPI_KEY
      },
      muteHttpExceptions: true
    });
    pageResult = JSON.parse(pageResponse.getContentText());
  } catch (err) {
    Logger.log("⚠️ API page error: " + err.message);
    return respond({ success: false, error: "Không thể kiểm tra thông tin tài khoản Facebook." });
  }

  var followers = 0;
  if (pageResult && pageResult.results) {
    followers = parseInt(pageResult.results.followers || 0, 10);
  }

  if (followers < CONFIG.MIN_FOLLOWERS) {
    return respond({
      success: false,
      error: "Tài khoản Facebook cần có tối thiểu " + CONFIG.MIN_FOLLOWERS + " followers. Hiện tại: " + followers + " followers."
    });
  }

  // ✅ Đủ điều kiện! Ghi vào sheet
  var id = Utilities.getUuid();
  sheet.appendRow([id, new Date(), email, postUrl, authorName, authorUrl, followers, "Approved"]);

  // Cấp quyền xem Drive folder
  try {
    var folder = DriveApp.getFolderById(CONFIG.GAS_KIT_FOLDER_ID);
    folder.addViewer(email);
    Logger.log("✅ Cấp quyền xem Drive folder cho: " + email);
  } catch (err) {
    Logger.log("⚠️ Lỗi cấp quyền Drive: " + err.message);
  }

  // Gửi email thông báo
  sendGasKitEmail(email, authorName);

  Logger.log("✅ GAS Kit approved cho: " + email + " | Followers: " + followers);

  return respond({
    success: true,
    message: "Xác thực thành công! Vui lòng kiểm tra email để nhận GAS Kit.",
    followers: followers,
    authorName: authorName
  });
}

/**
 * Gửi email thông báo nhận GAS Kit — HTML Premium
 */
function sendGasKitEmail(toEmail, name) {
  var subject = "🎁 Chúc mừng — Bạn đã nhận được GAS Kit Standard Miễn Phí!";

  var contentHtml = '<p style="color:#fafafa;font-size:16px;margin:0 0 20px;line-height:1.6;">Xin chào <strong>' + name + '</strong>,</p>'
    + '<p style="color:#d4d4d8;font-size:15px;margin:0 0 24px;line-height:1.7;">'
    + 'Chúc mừng! 🎉 Bạn đã hoàn thành thử thách và nhận được <strong style="color:#ff3366;">GAS Kit Standard</strong> miễn phí!</p>'
    // Info Card
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#27272a;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">'
    + '<tr><td style="padding:20px 24px;">'
    + '<table width="100%" cellpadding="0" cellspacing="0">'
    + '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;width:40%;">📦 Bộ Kit</td>'
    + '<td style="padding:8px 0;color:#fafafa;font-size:14px;font-weight:600;">GAS Kit Standard</td></tr>'
    + '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;">📂 Truy cập</td>'
    + '<td style="padding:8px 0;font-size:14px;font-weight:600;">'
    + '<a href="' + CONFIG.GAS_KIT_FOLDER_URL + '" style="color:#ff3366;text-decoration:underline;">Mở Google Drive</a></td></tr>'
    + '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;">✅ Trạng thái</td>'
    + '<td style="padding:8px 0;font-size:14px;font-weight:700;">'
    + '<span style="background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;padding:4px 12px;border-radius:999px;font-size:12px;">ĐÃ CẤP QUYỀN</span>'
    + '</td></tr>'
    + '</table></td></tr></table>'
    + '<p style="color:#d4d4d8;font-size:15px;margin:24px 0 8px;line-height:1.7;">'
    + 'Chúng tôi đã cấp quyền xem cho email <strong>' + toEmail + '</strong>. Bấm nút bên dưới để truy cập ngay!</p>'
    + '<p style="color:#71717a;font-size:13px;margin:0;line-height:1.6;">Lưu ý: Bạn cần đăng nhập bằng đúng email này trên Google Drive.</p>';

  var html = getEmailTemplate("Bạn đã nhận GAS Kit! 🎁", contentHtml, "Truy cập GAS Kit ngay", CONFIG.GAS_KIT_FOLDER_URL);

  try {
    GmailApp.sendEmail(toEmail, subject, "Vui lòng xem email này trên trình duyệt hỗ trợ HTML.", { htmlBody: html });
    Logger.log("📧 GAS Kit email gửi tới: " + toEmail);
  } catch (err) {
    Logger.log("⚠️ Lỗi gửi GAS Kit email: " + err.message);
  }
}

// ============================================================
// EMAIL SERVICE — Premium HTML Templates
// ============================================================

/**
 * Tạo base HTML template cho email (dark theme, đồng bộ giao diện web)
 */
function getEmailTemplate(title, contentHtml, ctaText, ctaUrl) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
    + '<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;"><tr><td align="center">'
    + '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">'
    // Header gradient
    + '<tr><td style="background:linear-gradient(135deg,#ff3366,#ff7733);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">'
    + '<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">' + title + '</h1>'
    + '</td></tr>'
    // Body
    + '<tr><td style="background-color:#18181b;padding:32px 40px;border-left:1px solid rgba(255,255,255,0.08);border-right:1px solid rgba(255,255,255,0.08);">'
    + contentHtml
    + '</td></tr>'
    // CTA Button (optional)
    + (ctaText ? '<tr><td style="background-color:#18181b;padding:0 40px 32px;text-align:center;border-left:1px solid rgba(255,255,255,0.08);border-right:1px solid rgba(255,255,255,0.08);">'
      + '<a href="' + ctaUrl + '" style="display:inline-block;background:linear-gradient(135deg,#ff3366,#ff7733);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:700;font-size:16px;">' + ctaText + '</a>'
      + '</td></tr>' : '')
    // Footer
    + '<tr><td style="background-color:#111113;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;border:1px solid rgba(255,255,255,0.05);border-top:none;">'
    + '<p style="margin:0;color:#71717a;font-size:12px;line-height:1.6;">'
    + '© 2026 Ai Funnel Course · Powered by Antigravity<br>'
    + 'Email này được gửi tự động, vui lòng không trả lời.</p>'
    + '</td></tr>'
    + '</table></td></tr></table></body></html>';
}

/**
 * Gửi email xác nhận khóa học (Paid hoặc Free) — HTML Premium
 */
function sendCourseEmail(toEmail, name, type) {
  var isPaid = (type === "paid");
  var subject = isPaid
    ? "🎉 Xác nhận Đăng ký — Khóa Học Xây Dựng Ai Funnel"
    : "🎁 Chúc mừng — Bạn nhận được Vé Miễn Phí!";

  var title = isPaid ? "Đăng ký thành công! 🎉" : "Bạn đã nhận Vé Miễn Phí! 🎁";
  var greeting = isPaid
    ? "Cảm ơn bạn đã đăng ký <strong>Khóa Học Xây Dựng Ai Funnel</strong>!"
    : "Chúc mừng! Bạn đã đủ điều kiện nhận <strong>Vé Miễn Phí</strong> nhờ chương trình giới thiệu!";

  var badgeBg = isPaid ? "linear-gradient(135deg,#ff3366,#ff7733)" : "linear-gradient(135deg,#22c55e,#16a34a)";
  var badgeText = isPaid ? "ĐÃ THANH TOÁN" : "MIỄN PHÍ";

  var contentHtml = '<p style="color:#fafafa;font-size:16px;margin:0 0 20px;line-height:1.6;">Xin chào <strong>' + name + '</strong>,</p>'
    + '<p style="color:#d4d4d8;font-size:15px;margin:0 0 24px;line-height:1.7;">' + greeting + '</p>'
    // Info Card
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#27272a;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">'
    + '<tr><td style="padding:20px 24px;">'
    + '<table width="100%" cellpadding="0" cellspacing="0">'
    + '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;width:40%;">📅 Ngày học</td>'
    + '<td style="padding:8px 0;color:#fafafa;font-size:14px;font-weight:600;">' + CONFIG.COURSE_DATE + '</td></tr>'
    + '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;">📹 Link Zoom</td>'
    + '<td style="padding:8px 0;color:#fafafa;font-size:14px;font-weight:600;">' + (CONFIG.ZOOM_LINK || "Sắp cập nhật") + '</td></tr>'
    + (isPaid ? '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;">🎁 GAS Kit</td>'
    + '<td style="padding:8px 0;color:#fafafa;font-size:14px;font-weight:600;">' + (CONFIG.GAS_KIT_LINK || "Sắp cập nhật") + '</td></tr>' : '')
    + '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;">💳 Hình thức</td>'
    + '<td style="padding:8px 0;font-size:14px;font-weight:700;">'
    + '<span style="background:' + badgeBg + ';color:#fff;padding:4px 12px;border-radius:999px;font-size:12px;">' + badgeText + '</span>'
    + '</td></tr>'
    + '</table></td></tr></table>'
    + '<p style="color:#71717a;font-size:13px;margin:24px 0 0;line-height:1.6;">Chúng tôi sẽ gửi thêm thông tin chi tiết trước ngày học. Hãy theo dõi email nhé!</p>';

  var html = getEmailTemplate(title, contentHtml, "", "");

  try {
    GmailApp.sendEmail(toEmail, subject, "Vui lòng xem email này trên trình duyệt hỗ trợ HTML.", { htmlBody: html });
    Logger.log("📧 Email HTML gửi thành công tới: " + toEmail);
  } catch (err) {
    Logger.log("⚠️ Lỗi gửi email: " + err.message);
  }
}

/**
 * Gửi email thông báo tiến độ referral (khi có 1 người đăng ký qua link)
 */
function sendReferralProgressEmail(toEmail, name, currentCount, refCode) {
  var subject = "🔥 Có người đăng ký qua link của bạn!";
  var remaining = 2 - currentCount;
  var siteUrl = "https://ai-funnel-course.vercel.app";
  var progressWidth = (currentCount * 50) + "%";

  var contentHtml = '<p style="color:#fafafa;font-size:16px;margin:0 0 20px;line-height:1.6;">Xin chào <strong>' + name + '</strong>,</p>'
    + '<p style="color:#d4d4d8;font-size:15px;margin:0 0 24px;line-height:1.7;">'
    + 'Tin vui! 🎉 Có <strong style="color:#ff3366;">1 người</strong> vừa đăng ký khóa học qua link giới thiệu của bạn!</p>'
    // Progress Card
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#27272a;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">'
    + '<tr><td style="padding:24px;">'
    + '<p style="color:#a1a1aa;font-size:13px;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Tiến độ giới thiệu</p>'
    // Progress Bar
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">'
    + '<tr><td style="background-color:#3f3f46;border-radius:999px;height:8px;padding:0;">'
    + '<div style="background:linear-gradient(90deg,#ff3366,#ff7733);border-radius:999px;height:8px;width:' + progressWidth + ';"></div>'
    + '</td></tr></table>'
    + '<table width="100%" cellpadding="0" cellspacing="0">'
    + '<tr><td style="color:#fafafa;font-size:28px;font-weight:800;">' + currentCount + '<span style="color:#71717a;font-size:16px;font-weight:400;"> / 2</span></td>'
    + '<td style="text-align:right;color:#ff7733;font-size:14px;font-weight:600;">Còn ' + remaining + ' người nữa!</td></tr>'
    + '</table></td></tr></table>'
    + '<p style="color:#d4d4d8;font-size:15px;margin:24px 0 8px;line-height:1.7;">'
    + 'Chỉ cần mời thêm <strong style="color:#ff7733;">' + remaining + ' người</strong> nữa, bạn sẽ nhận ngay <strong style="color:#22c55e;">Vé Miễn Phí</strong> tham gia khóa học! 🚀</p>'
    + '<p style="color:#71717a;font-size:13px;margin:0;line-height:1.6;">Chia sẻ link bên dưới cho bạn bè để hoàn thành thử thách nhé!</p>';

  var referralLink = siteUrl + "?ref=" + refCode;
  var html = getEmailTemplate("Bạn có 1 Referral mới! 🔥", contentHtml, "Chia sẻ link ngay", referralLink);

  try {
    GmailApp.sendEmail(toEmail, subject, "Vui lòng xem email này trên trình duyệt hỗ trợ HTML.", { htmlBody: html });
    Logger.log("📧 Referral progress email gửi tới: " + toEmail);
  } catch (err) {
    Logger.log("⚠️ Lỗi gửi referral progress email: " + err.message);
  }
}

// ============================================================
// HELPER
// ============================================================
function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
