// ============================================================
// Dự án: Khóa Học Xây Dựng Ai Funnel
// Backend: Google Apps Script
// ============================================================

const CONFIG = {
  SPREADSHEET_ID: "1mR7vS6nFQ-8A2v8Y3eXGBWJPB1ukm0GXTFPjs3qmOgs",
  SEPAY_TOKEN: "0651316513131331",
  COURSE_DATE: "2026-03-15",
  COURSE_TIME: "2/3/2026 - 19h30 thứ 2",
  ZOOM_LINK: "https://us06web.zoom.us/j/6426215363?omn=89413423261",
  GAS_KIT_LINK: "",
  ZALO_GROUP_LINK: "https://zalo.me/g/htxihe230",
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
  // Luon boc trong try-catch de tranh CORS Error (Bug #14, #15)
  try {
    const payload = JSON.parse(e.postData.contents); // (Bug #9 fix)
    const action = payload.action;

    if (action === "register") {
      return handleRegister(payload);
    } else if (action === "send_otp") {
      return handleSendOtp(payload);
    } else if (action === "verify_otp") {
      return handleVerifyOtp(payload);
    } else if (action === "sepay_webhook") {
      return handleSepayWebhook(payload);
    } else if (action === "verify_fb_share") {
      return handleVerifyFbShare(payload);
    } else if (action === "track_visit") {
      return handleTrackVisit(payload);
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
// OTP AUTHENTICATION
// ============================================================
function handleSendOtp(data) {
  const email = (data.email || "").trim().toLowerCase();
  if (!email) {
    return respond({ success: false, error: "Vui lòng nhập Email." });
  }

  // Tạo mã OTP 6 số ngẫu nhiên
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Lưu vào Cache 10 phút
  const cache = CacheService.getScriptCache();
  cache.put("OTP_" + email, otp, 600);
  
  // Gửi email
  sendOtpEmail(email, otp);
  Logger.log("🔑 Đã gửi OTP " + otp + " tới " + email);

  return respond({
    success: true,
    message: "Mã xác thực đã được gửi tới email của bạn."
  });
}

function handleVerifyOtp(data) {
  const email = (data.email || "").trim().toLowerCase();
  const userOtp = (data.otp || "").trim();

  if (!email || !userOtp) {
    return respond({ success: false, error: "Vui lòng nhập đầy đủ Email và mã OTP." });
  }

  const cache = CacheService.getScriptCache();
  const savedOtp = cache.get("OTP_" + email);

  if (!savedOtp) {
    return respond({ success: false, error: "Mã OTP đã hết hạn hoặc không tồn tại. Vui lòng gửi lại mã." });
  }

  if (savedOtp !== userOtp) {
    return respond({ success: false, error: "Mã OTP không chính xác. Vui lòng thử lại." });
  }

  // OTP hợp lệ -> Xoá khỏi cache để tránh dùng lại
  cache.remove("OTP_" + email);

  return respond({
    success: true,
    message: "Xác thực email thành công!"
  });
}

function sendOtpEmail(toEmail, otp) {
  var subject = "Mã xác thực tham gia Thử Thách Viral";
  var contentHtml = '<p style="color:#fafafa;font-size:16px;margin:0 0 20px;line-height:1.6;">Xin chào,</p>'
    + '<p style="color:#d4d4d8;font-size:15px;margin:0 0 24px;line-height:1.7;">Mã xác thực (OTP) của bạn để tham gia Thử Thách Viral nhận khóa học miễn phí là:</p>'
    + '<div style="background-color:#27272a;border-radius:12px;border:1px solid rgba(255,255,255,0.08);padding:24px;text-align:center;margin-bottom:24px;">'
    + '<span style="font-size:32px;font-weight:800;letter-spacing:4px;color:#ff3366;">' + otp + '</span>'
    + '</div>'
    + '<p style="color:#71717a;font-size:13px;margin:0;line-height:1.6;">Lưu ý: Mã này có hiệu lực trong vòng 10 phút. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>';

  var html = getEmailTemplate("X\u00e1c th\u1ef1c Email &#x1F512;", contentHtml, "", "");

  try {
    GmailApp.sendEmail(toEmail, subject, "M\u00e3 OTP c\u1ee7a b\u1ea1n l\u00e0: " + otp, { htmlBody: html });
  } catch (err) {
    Logger.log("L\u1ed7i g\u1eedi OTP email: " + err.message);
  }
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

  // Ghi vao Sheet (them Source o cot thu 10)
  var source = (data.source || "Direct").trim();
  sheet.appendRow([
    id, timestamp, name, email, phone,
    refCode, referredBy, "Pending", false, source
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
    Logger.log("🔗 Calling API: " + postApiUrl);
    var postResponse = UrlFetchApp.fetch(postApiUrl, {
      method: "GET",
      headers: {
        "x-rapidapi-host": CONFIG.RAPIDAPI_HOST,
        "x-rapidapi-key": CONFIG.RAPIDAPI_KEY
      },
      muteHttpExceptions: true
    });
    var responseCode = postResponse.getResponseCode();
    var responseText = postResponse.getContentText();
    Logger.log("📡 API response code: " + responseCode + " | Body (first 500): " + responseText.substring(0, 500));
    if (responseCode !== 200) {
      return respond({ success: false, error: "API trả về lỗi (code " + responseCode + "). Vui lòng thử lại." });
    }
    postResult = JSON.parse(responseText);
  } catch (err) {
    Logger.log("⚠️ API post error: " + err.message);
    return respond({ success: false, error: "Lỗi kết nối API: " + err.message });
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
  var subject = "Ch\u00fac m\u1eebng \u2014 B\u1ea1n \u0111\u00e3 nh\u1eadn \u0111\u01b0\u1ee3c GAS Kit Standard Mi\u1ec5n Ph\u00ed!";

  var contentHtml = '<p style="color:#fafafa;font-size:16px;margin:0 0 20px;line-height:1.6;">Xin ch\u00e0o <strong>' + name + '</strong>,</p>'
    + '<p style="color:#d4d4d8;font-size:15px;margin:0 0 24px;line-height:1.7;">'
    + 'Ch\u00fac m\u1eebng! &#x1F389; B\u1ea1n \u0111\u00e3 ho\u00e0n th\u00e0nh th\u1eed th\u00e1ch v\u00e0 nh\u1eadn \u0111\u01b0\u1ee3c <strong style="color:#ff3366;">GAS Kit Standard</strong> mi\u1ec5n ph\u00ed!</p>'
    // Info Card
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#27272a;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">'
    + '<tr><td style="padding:20px 24px;">'
    + '<table width="100%" cellpadding="0" cellspacing="0">'
    + '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;width:40%;">&#x1F4E6; B\u1ed9 Kit</td>'
    + '<td style="padding:8px 0;color:#fafafa;font-size:14px;font-weight:600;">GAS Kit Standard</td></tr>'
    + '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;">&#x1F4C2; Truy c\u1eadp</td>'
    + '<td style="padding:8px 0;font-size:14px;font-weight:600;">'
    + '<a href="' + CONFIG.GAS_KIT_FOLDER_URL + '" style="color:#ff3366;text-decoration:underline;">M\u1edf Google Drive</a></td></tr>'
    + '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;">&#x2705; Tr\u1ea1ng th\u00e1i</td>'
    + '<td style="padding:8px 0;font-size:14px;font-weight:700;">'
    + '<span style="background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;padding:4px 12px;border-radius:999px;font-size:12px;">\u0110\u00c3 C\u1ea4P QUY\u1ec0N</span>'
    + '</td></tr>'
    + '</table></td></tr></table>'
    + '<p style="color:#d4d4d8;font-size:15px;margin:24px 0 8px;line-height:1.7;">'
    + 'Ch\u00fang t\u00f4i \u0111\u00e3 c\u1ea5p quy\u1ec1n xem cho email <strong>' + toEmail + '</strong>. B\u1ea5m n\u00fat b\u00ean d\u01b0\u1edbi \u0111\u1ec3 truy c\u1eadp ngay!</p>'
    + '<p style="color:#71717a;font-size:13px;margin:0;line-height:1.6;">L\u01b0u \u00fd: B\u1ea1n c\u1ea7n \u0111\u0103ng nh\u1eadp b\u1eb1ng \u0111\u00fang email n\u00e0y tr\u00ean Google Drive.</p>';

  var html = getEmailTemplate("B\u1ea1n \u0111\u00e3 nh\u1eadn GAS Kit! &#x1F381;", contentHtml, "Truy c\u1eadp GAS Kit ngay", CONFIG.GAS_KIT_FOLDER_URL);

  try {
    GmailApp.sendEmail(toEmail, subject, "Vui l\u00f2ng xem email n\u00e0y tr\u00ean tr\u00ecnh duy\u1ec7t h\u1ed7 tr\u1ee3 HTML.", { htmlBody: html });
    Logger.log("GAS Kit email g\u1eedi t\u1edbi: " + toEmail);
  } catch (err) {
    Logger.log("L\u1ed7i g\u1eedi GAS Kit email: " + err.message);
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
    ? "X\u00e1c nh\u1eadn \u0110\u0103ng k\u00fd \u2014 Kh\u00f3a H\u1ecdc X\u00e2y D\u1ef1ng Ai Funnel"
    : "Ch\u00fac m\u1eebng \u2014 B\u1ea1n nh\u1eadn \u0111\u01b0\u1ee3c V\u00e9 Mi\u1ec5n Ph\u00ed!";

  var title = isPaid
    ? "\u0110\u0103ng k\u00fd th\u00e0nh c\u00f4ng! &#x1F389;"
    : "B\u1ea1n \u0111\u00e3 nh\u1eadn V\u00e9 Mi\u1ec5n Ph\u00ed! &#x1F381;";
  var greeting = isPaid
    ? "C\u1ea3m \u01a1n b\u1ea1n \u0111\u00e3 \u0111\u0103ng k\u00fd <strong>Kh\u00f3a H\u1ecdc X\u00e2y D\u1ef1ng Ai Funnel</strong>!"
    : "Ch\u00fac m\u1eebng! B\u1ea1n \u0111\u00e3 \u0111\u1ee7 \u0111i\u1ec1u ki\u1ec7n nh\u1eadn <strong>V\u00e9 Mi\u1ec5n Ph\u00ed</strong> nh\u1edd ch\u01b0\u01a1ng tr\u00ecnh gi\u1edbi thi\u1ec7u!";

  var badgeBg = isPaid ? "linear-gradient(135deg,#ff3366,#ff7733)" : "linear-gradient(135deg,#22c55e,#16a34a)";
  var badgeText = isPaid ? "\u0110\u00c3 THANH TO\u00c1N" : "MI\u1ec4N PH\u00cd";

  var contentHtml = '<p style="color:#fafafa;font-size:16px;margin:0 0 20px;line-height:1.6;">Xin ch\u00e0o <strong>' + name + '</strong>,</p>'
    + '<p style="color:#d4d4d8;font-size:15px;margin:0 0 24px;line-height:1.7;">' + greeting + '</p>'
    // Info Card
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#27272a;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">'
    + '<tr><td style="padding:20px 24px;">'
    + '<table width="100%" cellpadding="0" cellspacing="0">'
    + '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;width:35%;">&#x1F4C5; Th\u1eddi gian</td>'
    + '<td style="padding:8px 0;color:#fafafa;font-size:14px;font-weight:600;">' + CONFIG.COURSE_TIME + '</td></tr>'
    + '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;">&#x1F3A5; Link Zoom</td>'
    + '<td style="padding:8px 0;font-size:14px;font-weight:600;">'
    + '<a href="' + (CONFIG.ZOOM_LINK || "#") + '" style="color:#3b82f6;text-decoration:underline;word-break:break-all;">' + (CONFIG.ZOOM_LINK || "S\u1eafp c\u1eadp nh\u1eadt") + '</a></td></tr>'
    + (isPaid ? '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;">&#x1F381; GAS Kit</td>'
    + '<td style="padding:8px 0;color:#fafafa;font-size:14px;font-weight:600;">' + (CONFIG.GAS_KIT_LINK || "S\u1eafp c\u1eadp nh\u1eadt") + '</td></tr>' : '')
    + '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;">&#x1F4AC; Nh\u00f3m Zalo</td>'
    + '<td style="padding:8px 0;font-size:14px;font-weight:600;">'
    + '<a href="' + CONFIG.ZALO_GROUP_LINK + '" style="color:#10b981;text-decoration:underline;">Tham gia ngay</a></td></tr>'
    + '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;">&#x1F4B3; Tr\u1ea1ng th\u00e1i</td>'
    + '<td style="padding:8px 0;font-size:14px;font-weight:700;">'
    + '<span style="background:' + badgeBg + ';color:#fff;padding:4px 12px;border-radius:999px;font-size:12px;">' + badgeText + '</span>'
    + '</td></tr>'
    + '</table></td></tr></table>';

  if (!isPaid) {
    contentHtml += '<div style="margin-top:24px;background-color:rgba(234,179,8,0.1);border-left:4px solid #eab308;padding:16px;">'
      + '<p style="margin:0;color:#fef08a;font-size:14px;font-weight:600;margin-bottom:8px;">&#x26A0;&#xFE0F; L\u01b0u \u00fd quan tr\u1ecdng khi v\u00e0o Zoom:</p>'
      + '<p style="margin:0;color:#d4d4d8;font-size:14px;line-height:1.6;">B\u1ea1n b\u1eaft bu\u1ed9c ph\u1ea3i <strong>\u0110\u1ed5i t\u00ean theo c\u00fa ph\u00e1p: T\u00ean + S\u0110T \u0111\u0103ng k\u00fd c\u1ee7a b\u1ea1n</strong>.<br>V\u00ed d\u1ee5: <strong>Gi\u00e1p - 0362675331</strong>. Ban t\u1ed5 ch\u1ee9c s\u1ebd duy\u1ec7t d\u1ef1a tr\u00ean danh s\u00e1ch \u0111\u0103ng k\u00fd.</p>'
      + '</div>';
  } else {
    contentHtml += '<p style="color:#71717a;font-size:13px;margin:24px 0 0;line-height:1.6;">Ch\u00fang t\u00f4i s\u1ebd g\u1eedi th\u00eam th\u00f4ng tin chi ti\u1ebft tr\u01b0\u1edbc ng\u00e0y h\u1ecdc. H\u00e3y theo d\u00f5i email nh\u00e9!</p>';
  }

  var html = getEmailTemplate(title, contentHtml, "", "");

  try {
    GmailApp.sendEmail(toEmail, subject, "Vui l\u00f2ng xem email n\u00e0y tr\u00ean tr\u00ecnh duy\u1ec7t h\u1ed7 tr\u1ee3 HTML.", { htmlBody: html });
    Logger.log("Email HTML g\u1eedi th\u00e0nh c\u00f4ng t\u1edbi: " + toEmail);
  } catch (err) {
    Logger.log("L\u1ed7i g\u1eedi email: " + err.message);
  }
}

/**
 * Gửi email thông báo tiến độ referral (khi có 1 người đăng ký qua link)
 */
function sendReferralProgressEmail(toEmail, name, currentCount, refCode) {
  var subject = "C\u00f3 ng\u01b0\u1eddi \u0111\u0103ng k\u00fd qua link c\u1ee7a b\u1ea1n!";
  var remaining = 2 - currentCount;
  var siteUrl = "https://ai-funnel-course.vercel.app";
  var progressWidth = (currentCount * 50) + "%";

  var contentHtml = '<p style="color:#fafafa;font-size:16px;margin:0 0 20px;line-height:1.6;">Xin ch\u00e0o <strong>' + name + '</strong>,</p>'
    + '<p style="color:#d4d4d8;font-size:15px;margin:0 0 24px;line-height:1.7;">'
    + 'Tin vui! &#x1F389; C\u00f3 <strong style="color:#ff3366;">1 ng\u01b0\u1eddi</strong> v\u1eeba \u0111\u0103ng k\u00fd kh\u00f3a h\u1ecdc qua link gi\u1edbi thi\u1ec7u c\u1ee7a b\u1ea1n!</p>'
    // Progress Card
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#27272a;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">'
    + '<tr><td style="padding:24px;">'
    + '<p style="color:#a1a1aa;font-size:13px;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Ti\u1ebfn \u0111\u1ed9 gi\u1edbi thi\u1ec7u</p>'
    // Progress Bar
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">'
    + '<tr><td style="background-color:#3f3f46;border-radius:999px;height:8px;padding:0;">'
    + '<div style="background:linear-gradient(90deg,#ff3366,#ff7733);border-radius:999px;height:8px;width:' + progressWidth + ';"></div>'
    + '</td></tr></table>'
    + '<table width="100%" cellpadding="0" cellspacing="0">'
    + '<tr><td style="color:#fafafa;font-size:28px;font-weight:800;">' + currentCount + '<span style="color:#71717a;font-size:16px;font-weight:400;"> / 2</span></td>'
    + '<td style="text-align:right;color:#ff7733;font-size:14px;font-weight:600;">C\u00f2n ' + remaining + ' ng\u01b0\u1eddi n\u1eefa!</td></tr>'
    + '</table></td></tr></table>'
    + '<p style="color:#d4d4d8;font-size:15px;margin:24px 0 8px;line-height:1.7;">'
    + 'Ch\u1ec9 c\u1ea7n m\u1eddi th\u00eam <strong style="color:#ff7733;">' + remaining + ' ng\u01b0\u1eddi</strong> n\u1eefa, b\u1ea1n s\u1ebd nh\u1eadn ngay <strong style="color:#22c55e;">V\u00e9 Mi\u1ec5n Ph\u00ed</strong> tham gia kh\u00f3a h\u1ecdc! &#x1F680;</p>'
    + '<p style="color:#71717a;font-size:13px;margin:0;line-height:1.6;">Chia s\u1ebb link b\u00ean d\u01b0\u1edbi cho b\u1ea1n b\u00e8 \u0111\u1ec3 ho\u00e0n th\u00e0nh th\u1eed th\u00e1ch nh\u00e9!</p>';

  var referralLink = siteUrl + "?ref=" + refCode;
  var html = getEmailTemplate("B\u1ea1n c\u00f3 1 Referral m\u1edbi! &#x1F525;", contentHtml, "Chia s\u1ebb link ngay", referralLink);

  try {
    GmailApp.sendEmail(toEmail, subject, "Vui l\u00f2ng xem email n\u00e0y tr\u00ean tr\u00ecnh duy\u1ec7t h\u1ed7 tr\u1ee3 HTML.", { htmlBody: html });
    Logger.log("Referral progress email g\u1eedi t\u1edbi: " + toEmail);
  } catch (err) {
    Logger.log("L\u1ed7i g\u1eedi referral progress email: " + err.message);
  }
}

// ============================================================
// MENU: Custom Menu khi mo Google Sheet
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Bao Cao")
    .addItem("Bao Cao Chien Dich", "showCampaignReport")
    .addToUi();
}

// ============================================================
// SETUP: Tao tab PageViews (chay 1 lan)
// ============================================================
function setupPageViewsSheet() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var existing = ss.getSheetByName("PageViews");
  if (existing) {
    Logger.log("Tab PageViews da ton tai");
    return;
  }
  var sheet = ss.insertSheet("PageViews");
  sheet.appendRow(["ID", "Timestamp", "Source", "Medium", "Campaign", "UserAgent", "Referrer", "Page"]);
  sheet.setFrozenRows(1);
  Logger.log("Tao tab PageViews thanh cong");
}

// ============================================================
// TRACK VISIT: Ghi nhan luot truy cap website
// ============================================================
function handleTrackVisit(data) {
  try {
    var sheet = getSheet("PageViews");
    if (!sheet) {
      setupPageViewsSheet();
      sheet = getSheet("PageViews");
    }

    var id = Utilities.getUuid();
    var source = (data.source || "Direct").trim();
    var medium = (data.medium || "").trim();
    var campaign = (data.campaign || "").trim();
    var userAgent = (data.userAgent || "").trim();
    var referrer = (data.referrer || "").trim();
    var page = (data.page || "/").trim();

    sheet.appendRow([id, new Date(), source, medium, campaign, userAgent, referrer, page]);
    Logger.log("Tracked visit from: " + source);

    return respond({ success: true });
  } catch (e) {
    Logger.log("Tracking Error: " + e.toString());
    return respond({ success: true }); // Tra ve success de khong anh huong UX
  }
}

// ============================================================
// CAMPAIGN REPORT: Mo sidebar bao cao
// ============================================================
function showCampaignReport() {
  var html = HtmlService.createHtmlOutputFromFile("Report")
    .setTitle("Bao Cao Chien Dich")
    .setWidth(420);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Lay du lieu bao cao tong hop: Traffic, Lead, Order
 */
function getReportData() {
  var result = {
    traffic: { total: 0, sources: {} },
    leads: { total: 0, sources: {} },
    orders: { total: 0, free: 0, paid: 0, sources: {} },
    conversions: { trafficToLead: 0, leadToOrder: 0 }
  };

  // --- TRAFFIC (PageViews) ---
  var pvSheet = getSheet("PageViews");
  if (pvSheet && pvSheet.getLastRow() > 1) {
    var pvData = pvSheet.getDataRange().getValues();
    var pvHeaders = pvData[0];
    var srcCol = pvHeaders.indexOf("Source");

    for (var i = 1; i < pvData.length; i++) {
      var src = String(pvData[i][srcCol] || "Direct").trim();
      if (!src) src = "Direct";
      result.traffic.total++;
      result.traffic.sources[src] = (result.traffic.sources[src] || 0) + 1;
    }
  }

  // --- LEADS & ORDERS (Users) ---
  var userSheet = getSheet("Users");
  if (userSheet && userSheet.getLastRow() > 1) {
    var uData = userSheet.getDataRange().getValues();
    var uHeaders = uData[0];
    var statusCol = uHeaders.indexOf("Status");
    var refByCol = uHeaders.indexOf("ReferredBy");
    // Source co the o cot 10 (index 9) hoac co ten "Source"
    var sourceCol = uHeaders.indexOf("Source");
    if (sourceCol === -1) sourceCol = 9; // fallback cot thu 10

    for (var j = 1; j < uData.length; j++) {
      var row = uData[j];
      var status = String(row[statusCol] || "").trim().toLowerCase();
      var referredBy = String(row[refByCol] || "").trim();
      var userSource = String(row[sourceCol] || "Direct").trim();
      if (!userSource) userSource = "Direct";

      // Moi dong trong Users = 1 lead
      result.leads.total++;
      result.leads.sources[userSource] = (result.leads.sources[userSource] || 0) + 1;

      // Order = Paid hoac Free
      if (status === "paid" || status === "free") {
        result.orders.total++;
        result.orders.sources[userSource] = (result.orders.sources[userSource] || 0) + 1;
        if (status === "paid") {
          result.orders.paid++;
        } else {
          result.orders.free++;
        }
      }
    }
  }

  // --- CONVERSION RATES ---
  if (result.traffic.total > 0) {
    result.conversions.trafficToLead = Math.round((result.leads.total / result.traffic.total) * 1000) / 10;
  }
  if (result.leads.total > 0) {
    result.conversions.leadToOrder = Math.round((result.orders.total / result.leads.total) * 1000) / 10;
  }

  return result;
}

/**
 * Lay chi tiet danh sach Referral (drill-down)
 */
function getReferralDetails() {
  var userSheet = getSheet("Users");
  if (!userSheet || userSheet.getLastRow() <= 1) return [];

  var data = userSheet.getDataRange().getValues();
  var headers = data[0];
  var nameCol = headers.indexOf("FullName");
  var emailCol = headers.indexOf("Email");
  var refCodeCol = headers.indexOf("RefCode");
  var refByCol = headers.indexOf("ReferredBy");
  var statusCol = headers.indexOf("Status");

  // Dem so nguoi duoc gioi thieu boi moi RefCode
  var refMap = {}; // { refCode: { name, email, count, status } }

  // Buoc 1: Tim tat ca referrers (nguoi co RefCode)
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var refCode = String(row[refCodeCol] || "").trim();
    if (refCode) {
      refMap[refCode] = {
        name: String(row[nameCol] || ""),
        email: String(row[emailCol] || ""),
        refCode: refCode,
        status: String(row[statusCol] || ""),
        referralCount: 0
      };
    }
  }

  // Buoc 2: Dem so nguoi duoc gioi thieu
  for (var k = 1; k < data.length; k++) {
    var referredBy = String(data[k][refByCol] || "").trim();
    if (referredBy && refMap[referredBy]) {
      refMap[referredBy].referralCount++;
    }
  }

  // Buoc 3: Chi tra ve nhung nguoi co it nhat 1 referral
  var results = [];
  for (var code in refMap) {
    if (refMap[code].referralCount > 0) {
      results.push(refMap[code]);
    }
  }

  // Sap xep theo so luong referral giam dan
  results.sort(function(a, b) { return b.referralCount - a.referralCount; });

  return results;
}

// ============================================================
// HELPER
// ============================================================
function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
