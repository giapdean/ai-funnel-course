// ============================================================
// Dá»± Ã¡n: KhÃ³a Há»c XÃ¢y Dá»±ng Ai Funnel
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
// SETUP: Cháº¡y 1 láº§n Ä‘á»ƒ táº¡o Google Sheet Database
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
  
  Logger.log("âœ… Spreadsheet created: " + ss.getUrl());
  Logger.log("ðŸ“‹ Spreadsheet ID: " + ss.getId());
  Logger.log("âš ï¸ HÃƒY COPY Spreadsheet ID nÃ y vÃ o CONFIG.SPREADSHEET_ID á»Ÿ Code.gs!");
  
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
  // âš¡ DÃ¹ng sá»‘ Ä‘iá»‡n thoáº¡i lÃ m RefCode (Ä‘á»“ng bá»™ vá»›i frontend index.html)
  // CÃ´ng thá»©c: chá»‰ giá»¯ sá»‘, láº¥y 6 chá»¯ sá»‘ cuá»‘i
  if (!phone) {
    Logger.log("âš ï¸ generateRefCode: phone is empty!");
    return "000000";
  }
  return phone.replace(/\D/g, "").slice(-6);
}

function generatePaymentCode(email) {
  // Format: AIFUNNEL + RefCode -- dÃ¹ng toUpperCase Ä‘á»ƒ trÃ¡nh mismatch
  const refCode = email.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "X");
  return "AIFUNNEL" + refCode + Date.now().toString().slice(-4);
}

// ============================================================
// MAIN ENDPOINT
// ============================================================
function doPost(e) {
  // âš¡ LuÃ´n bá»c trong try-catch Ä‘á»ƒ trÃ¡nh CORS Error (Bug #14, #15)
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

  // Táº¡o RefCode vÃ  PaymentCode
  const refCode = generateRefCode(phone);
  const paymentCode = generatePaymentCode(email);
  const id = Utilities.getUuid();
  const timestamp = new Date();

  // Ghi vÃ o Sheet
  sheet.appendRow([
    id, timestamp, name, email, phone,
    refCode, referredBy, "Pending", false
  ]);

  // Náº¿u Ä‘Æ°á»£c giá»›i thiá»‡u, check Referral
  if (referredBy) {
    checkAndGrantFreeAccess(referredBy);
  }

  return respond({
    success: true,
    refCode: refCode,
    paymentCode: paymentCode,
    message: "ÄÄƒng kÃ½ thÃ nh cÃ´ng!"
  });
}

// ============================================================
// REFERRAL: Check vÃ  cáº¥p quyá»n Free
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

  // âš¡ LuÃ´n cast sang String vÃ¬ Google Sheets tráº£ vá» Number cho RefCode toÃ n sá»‘
  const refCodeTarget = String(referrerRefCode).trim();
  Logger.log("ðŸ” Checking referral for RefCode: " + refCodeTarget);

  // Äáº¿m sá»‘ ngÆ°á»i Ä‘Æ°á»£c giá»›i thiá»‡u bá»Ÿi referrerRefCode
  let count = 0;
  let referrerRow = -1;
  let referrerData = null;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // âš¡ Cast sang String trÆ°á»›c khi so sÃ¡nh (fix Bug: Number !== String)
    const rowRefCode = String(row[refCodeCol] || "").trim();
    const rowReferredBy = String(row[referredByCol] || "").trim();
    const rowStatus = String(row[statusCol] || "").trim().toLowerCase();

    // TÃ¬m hÃ ng cá»§a ngÆ°á»i giá»›i thiá»‡u
    if (rowRefCode === refCodeTarget) {
      referrerRow = i + 1;
      referrerData = row;
    }
    // Äáº¿m sá»‘ ngÆ°á»i Ä‘Æ°á»£c giá»›i thiá»‡u (vÃ  Ä‘Ã£ Ä‘Äƒng kÃ½ tháº­t - Pending/Paid/Free)
    if (rowReferredBy === refCodeTarget && (rowStatus === "pending" || rowStatus === "paid" || rowStatus === "free")) {
      count++;
    }
  }

  Logger.log("ðŸ“Š Referral count for " + refCodeTarget + ": " + count + " | Referrer found at row: " + referrerRow);

  if (!referrerData || referrerRow < 0) return;

  const currentStatus = String(referrerData[statusCol] || "").trim().toLowerCase();

  // ðŸ”” Khi cÃ³ Ä‘Ãºng 1 ngÆ°á»i giá»›i thiá»‡u -> gá»­i email thÃ´ng bÃ¡o tiáº¿n Ä‘á»™
  if (count === 1 && currentStatus === "pending") {
    sendReferralProgressEmail(referrerData[emailCol], referrerData[nameCol], count, refCodeTarget);
    Logger.log("ðŸ“§ Gá»­i email thÃ´ng bÃ¡o 1 referral cho: " + referrerData[emailCol]);
  }

  // ðŸŽ‰ Náº¿u Ä‘á»§ 2 ngÆ°á»i vÃ  ngÆ°á»i giá»›i thiá»‡u váº«n cÃ²n Pending -> cáº¥p Free
  if (count >= 2 && currentStatus === "pending") {
    sheet.getRange(referrerRow, statusCol + 1).setValue("Free");
    // Gá»­i email náº¿u chÆ°a gá»­i
    if (!referrerData[emailSentCol]) {
      sendCourseEmail(referrerData[emailCol], referrerData[nameCol], "free");
      sheet.getRange(referrerRow, emailSentCol + 1).setValue(true);
      Logger.log("âœ… Cáº¥p Free cho: " + referrerData[emailCol]);
    }
  }
}

// ============================================================
// SEPAY WEBHOOK HANDLER
// ============================================================
function handleSepayWebhook(data) {
  // Normalize Ä‘á»ƒ trÃ¡nh Bug #19 (khoáº£ng tráº¯ng, hoa thÆ°á»ng)
  const transferContent = (data.transferContent || "").toUpperCase().replace(/\s/g, "");
  const amount = parseFloat(data.transferAmount || 0);

  Logger.log("ðŸ“© Webhook received: " + transferContent + " | " + amount);

  // Ghi Transaction log
  const txSheet = getSheet("Transactions");
  const txId = Utilities.getUuid();
  txSheet.appendRow([txId, new Date(), "", amount, transferContent, "received"]);

  // TÃ¬m user cÃ³ PaymentCode khá»›p trong ná»™i dung chuyá»ƒn khoáº£n
  if (amount >= 3000000 && transferContent.includes("AIFUNNEL")) {
    const userSheet = getSheet("Users");
    const data2 = userSheet.getDataRange().getValues();
    const headers = data2[0];
    const emailCol = headers.indexOf("Email");
    const statusCol = headers.indexOf("Status");
    const nameCol = headers.indexOf("FullName");
    const emailSentCol = headers.indexOf("EmailSent");

    // Tra cá»©u user cÃ³ email trong content (táº¡m thá»i dÃ¹ng cÃ¡ch kiá»ƒm tra Ä‘Æ¡n giáº£n)
    for (let i = 1; i < data2.length; i++) {
      const row = data2[i];
      const email = (row[emailCol] || "").toLowerCase();
      const emailNorm = email.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "X");
      const expectedCode = "AIFUNNEL" + emailNorm;
      
      if (transferContent.includes(expectedCode) && row[statusCol] === "Pending") {
        userSheet.getRange(i + 1, statusCol + 1).setValue("Paid");
        // Cáº­p nháº­t txSheet vá»›i email
        txSheet.getRange(txSheet.getLastRow(), emailCol + 1).setValue(email);
        // Gá»­i email xÃ¡c nháº­n
        if (!row[emailSentCol]) {
          sendCourseEmail(email, row[nameCol], "paid");
          userSheet.getRange(i + 1, emailSentCol + 1).setValue(true);
        }
        Logger.log("âœ… Thanh toÃ¡n OK: " + email);
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
 * Setup: Táº¡o tab GASKit trong Spreadsheet (cháº¡y 1 láº§n)
 */
function setupGASKitSheet() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var existing = ss.getSheetByName("GASKit");
  if (existing) {
    Logger.log("âš ï¸ Tab GASKit Ä‘Ã£ tá»“n táº¡i");
    return;
  }
  var sheet = ss.insertSheet("GASKit");
  sheet.appendRow(["ID", "Timestamp", "Email", "PostURL", "AuthorName", "AuthorURL", "Followers", "Status"]);
  sheet.setFrozenRows(1);
  Logger.log("âœ… Táº¡o tab GASKit thÃ nh cÃ´ng");
}

/**
 * Handler: XÃ¡c thá»±c bÃ i viáº¿t Facebook vÃ  cáº¥p GAS Kit
 */
function handleVerifyFbShare(data) {
  var email = (data.email || "").trim().toLowerCase();
  var postUrl = (data.postUrl || "").trim();

  if (!email || !postUrl) {
    return respond({ success: false, error: "Vui lÃ²ng nháº­p Email vÃ  Link bÃ i viáº¿t." });
  }

  // âš¡ Chá»‘ng duplicate: check email Ä‘Ã£ nháº­n chÆ°a
  var sheet = getSheet("GASKit");
  if (!sheet) {
    // Tá»± táº¡o tab náº¿u chÆ°a cÃ³
    setupGASKitSheet();
    sheet = getSheet("GASKit");
  }
  var existingData = sheet.getDataRange().getValues();
  for (var i = 1; i < existingData.length; i++) {
    var rowEmail = String(existingData[i][2] || "").trim().toLowerCase();
    var rowStatus = String(existingData[i][7] || "").trim().toLowerCase();
    if (rowEmail === email && rowStatus === "approved") {
      return respond({ success: false, error: "Email nÃ y Ä‘Ã£ nháº­n GAS Kit rá»“i! Má»—i email chá»‰ Ä‘Æ°á»£c nháº­n 1 láº§n." });
    }
  }

  // Step 1: Gá»i API láº¥y ná»™i dung bÃ i viáº¿t
  var postResult;
  try {
    var postApiUrl = "https://" + CONFIG.RAPIDAPI_HOST + "/post?post_url=" + encodeURIComponent(postUrl);
    Logger.log("ðŸ”— Calling API: " + postApiUrl);
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
    Logger.log("ðŸ“¡ API response code: " + responseCode + " | Body (first 500): " + responseText.substring(0, 500));
    if (responseCode !== 200) {
      return respond({ success: false, error: "API tráº£ vá» lá»—i (code " + responseCode + "). Vui lÃ²ng thá»­ láº¡i." });
    }
    postResult = JSON.parse(responseText);
  } catch (err) {
    Logger.log("âš ï¸ API post error: " + err.message);
    return respond({ success: false, error: "Lá»—i káº¿t ná»‘i API: " + err.message });
  }

  if (!postResult || !postResult.results || !postResult.results.message) {
    return respond({ success: false, error: "KhÃ´ng tÃ¬m tháº¥y bÃ i viáº¿t hoáº·c bÃ i viáº¿t khÃ´ng cÃ´ng khai." });
  }

  // Check hashtag #aifunnel (case-insensitive)
  var postMessage = (postResult.results.message || "").toLowerCase();
  if (postMessage.indexOf("#aifunnel") === -1) {
    return respond({ success: false, error: "BÃ i viáº¿t chÆ°a cÃ³ hashtag #aifunnel. Vui lÃ²ng thÃªm hashtag vÃ  thá»­ láº¡i." });
  }

  // Láº¥y thÃ´ng tin tÃ¡c giáº£
  var authorName = (postResult.results.author && postResult.results.author.name) || "Unknown";
  var authorUrl = (postResult.results.author && postResult.results.author.url) || "";

  if (!authorUrl) {
    return respond({ success: false, error: "KhÃ´ng láº¥y Ä‘Æ°á»£c thÃ´ng tin tÃ¡c giáº£. Vui lÃ²ng kiá»ƒm tra bÃ i viáº¿t." });
  }

  // Step 2: Gá»i API kiá»ƒm tra followers
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
    Logger.log("âš ï¸ API page error: " + err.message);
    return respond({ success: false, error: "KhÃ´ng thá»ƒ kiá»ƒm tra thÃ´ng tin tÃ i khoáº£n Facebook." });
  }

  var followers = 0;
  if (pageResult && pageResult.results) {
    followers = parseInt(pageResult.results.followers || 0, 10);
  }

  if (followers < CONFIG.MIN_FOLLOWERS) {
    return respond({
      success: false,
      error: "TÃ i khoáº£n Facebook cáº§n cÃ³ tá»‘i thiá»ƒu " + CONFIG.MIN_FOLLOWERS + " followers. Hiá»‡n táº¡i: " + followers + " followers."
    });
  }

  // âœ… Äá»§ Ä‘iá»u kiá»‡n! Ghi vÃ o sheet
  var id = Utilities.getUuid();
  sheet.appendRow([id, new Date(), email, postUrl, authorName, authorUrl, followers, "Approved"]);

  // Cáº¥p quyá»n xem Drive folder
  try {
    var folder = DriveApp.getFolderById(CONFIG.GAS_KIT_FOLDER_ID);
    folder.addViewer(email);
    Logger.log("âœ… Cáº¥p quyá»n xem Drive folder cho: " + email);
  } catch (err) {
    Logger.log("âš ï¸ Lá»—i cáº¥p quyá»n Drive: " + err.message);
  }

  // Gá»­i email thÃ´ng bÃ¡o
  sendGasKitEmail(email, authorName);

  Logger.log("âœ… GAS Kit approved cho: " + email + " | Followers: " + followers);

  return respond({
    success: true,
    message: "XÃ¡c thá»±c thÃ nh cÃ´ng! Vui lÃ²ng kiá»ƒm tra email Ä‘á»ƒ nháº­n GAS Kit.",
    followers: followers,
    authorName: authorName
  });
}

/**
 * Gá»­i email thÃ´ng bÃ¡o nháº­n GAS Kit â€” HTML Premium
 */
function sendGasKitEmail(toEmail, name) {
  var subject = "ðŸŽ ChÃºc má»«ng â€” Báº¡n Ä‘Ã£ nháº­n Ä‘Æ°á»£c GAS Kit Standard Miá»…n PhÃ­!";

  var contentHtml = '<p style="color:#fafafa;font-size:16px;margin:0 0 20px;line-height:1.6;">Xin chÃ o <strong>' + name + '</strong>,</p>'
    + '<p style="color:#d4d4d8;font-size:15px;margin:0 0 24px;line-height:1.7;">'
    + 'ChÃºc má»«ng! ðŸŽ‰ Báº¡n Ä‘Ã£ hoÃ n thÃ nh thá»­ thÃ¡ch vÃ  nháº­n Ä‘Æ°á»£c <strong style="color:#ff3366;">GAS Kit Standard</strong> miá»…n phÃ­!</p>'
    // Info Card
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#27272a;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">'
    + '<tr><td style="padding:20px 24px;">'
    + '<table width="100%" cellpadding="0" cellspacing="0">'
    + '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;width:40%;">ðŸ“¦ Bá»™ Kit</td>'
    + '<td style="padding:8px 0;color:#fafafa;font-size:14px;font-weight:600;">GAS Kit Standard</td></tr>'
    + '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;">ðŸ“‚ Truy cáº­p</td>'
    + '<td style="padding:8px 0;font-size:14px;font-weight:600;">'
    + '<a href="' + CONFIG.GAS_KIT_FOLDER_URL + '" style="color:#ff3366;text-decoration:underline;">Má»Ÿ Google Drive</a></td></tr>'
    + '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;">âœ… Tráº¡ng thÃ¡i</td>'
    + '<td style="padding:8px 0;font-size:14px;font-weight:700;">'
    + '<span style="background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;padding:4px 12px;border-radius:999px;font-size:12px;">ÄÃƒ Cáº¤P QUYá»€N</span>'
    + '</td></tr>'
    + '</table></td></tr></table>'
    + '<p style="color:#d4d4d8;font-size:15px;margin:24px 0 8px;line-height:1.7;">'
    + 'ChÃºng tÃ´i Ä‘Ã£ cáº¥p quyá»n xem cho email <strong>' + toEmail + '</strong>. Báº¥m nÃºt bÃªn dÆ°á»›i Ä‘á»ƒ truy cáº­p ngay!</p>'
    + '<p style="color:#71717a;font-size:13px;margin:0;line-height:1.6;">LÆ°u Ã½: Báº¡n cáº§n Ä‘Äƒng nháº­p báº±ng Ä‘Ãºng email nÃ y trÃªn Google Drive.</p>';

  var html = getEmailTemplate("Báº¡n Ä‘Ã£ nháº­n GAS Kit! ðŸŽ", contentHtml, "Truy cáº­p GAS Kit ngay", CONFIG.GAS_KIT_FOLDER_URL);

  try {
    GmailApp.sendEmail(toEmail, subject, "Vui lÃ²ng xem email nÃ y trÃªn trÃ¬nh duyá»‡t há»— trá»£ HTML.", { htmlBody: html });
    Logger.log("ðŸ“§ GAS Kit email gá»­i tá»›i: " + toEmail);
  } catch (err) {
    Logger.log("âš ï¸ Lá»—i gá»­i GAS Kit email: " + err.message);
  }
}

// ============================================================
// EMAIL SERVICE â€” Premium HTML Templates
// ============================================================

/**
 * Táº¡o base HTML template cho email (dark theme, Ä‘á»“ng bá»™ giao diá»‡n web)
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
    + 'Â© 2026 Ai Funnel Course Â· Powered by Antigravity<br>'
    + 'Email nÃ y Ä‘Æ°á»£c gá»­i tá»± Ä‘á»™ng, vui lÃ²ng khÃ´ng tráº£ lá»i.</p>'
    + '</td></tr>'
    + '</table></td></tr></table></body></html>';
}

/**
 * Gá»­i email xÃ¡c nháº­n khÃ³a há»c (Paid hoáº·c Free) â€” HTML Premium
 */
function sendCourseEmail(toEmail, name, type) {
  var isPaid = (type === "paid");
  var subject = isPaid
    ? "ðŸŽ‰ XÃ¡c nháº­n ÄÄƒng kÃ½ â€” KhÃ³a Há»c XÃ¢y Dá»±ng Ai Funnel"
    : "ðŸŽ ChÃºc má»«ng â€” Báº¡n nháº­n Ä‘Æ°á»£c VÃ© Miá»…n PhÃ­!";

  var title = isPaid ? "ÄÄƒng kÃ½ thÃ nh cÃ´ng! ðŸŽ‰" : "Báº¡n Ä‘Ã£ nháº­n VÃ© Miá»…n PhÃ­! ðŸŽ";
  var greeting = isPaid
    ? "Cáº£m Æ¡n báº¡n Ä‘Ã£ Ä‘Äƒng kÃ½ <strong>KhÃ³a Há»c XÃ¢y Dá»±ng Ai Funnel</strong>!"
    : "ChÃºc má»«ng! Báº¡n Ä‘Ã£ Ä‘á»§ Ä‘iá»u kiá»‡n nháº­n <strong>VÃ© Miá»…n PhÃ­</strong> nhá» chÆ°Æ¡ng trÃ¬nh giá»›i thiá»‡u!";

  var badgeBg = isPaid ? "linear-gradient(135deg,#ff3366,#ff7733)" : "linear-gradient(135deg,#22c55e,#16a34a)";
  var badgeText = isPaid ? "ÄÃƒ THANH TOÃN" : "MIá»„N PHÃ";

  var contentHtml = '<p style="color:#fafafa;font-size:16px;margin:0 0 20px;line-height:1.6;">Xin chÃ o <strong>' + name + '</strong>,</p>'
    + '<p style="color:#d4d4d8;font-size:15px;margin:0 0 24px;line-height:1.7;">' + greeting + '</p>'
    // Info Card
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#27272a;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">'
    + '<tr><td style="padding:20px 24px;">'
    + '<table width="100%" cellpadding="0" cellspacing="0">'
    + '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;width:40%;">ðŸ“… NgÃ y há»c</td>'
    + '<td style="padding:8px 0;color:#fafafa;font-size:14px;font-weight:600;">' + CONFIG.COURSE_DATE + '</td></tr>'
    + '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;">ðŸ“¹ Link Zoom</td>'
    + '<td style="padding:8px 0;color:#fafafa;font-size:14px;font-weight:600;">' + (CONFIG.ZOOM_LINK || "Sáº¯p cáº­p nháº­t") + '</td></tr>'
    + (isPaid ? '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;">ðŸŽ GAS Kit</td>'
    + '<td style="padding:8px 0;color:#fafafa;font-size:14px;font-weight:600;">' + (CONFIG.GAS_KIT_LINK || "Sáº¯p cáº­p nháº­t") + '</td></tr>' : '')
    + '<tr><td style="padding:8px 0;color:#a1a1aa;font-size:14px;">ðŸ’³ HÃ¬nh thá»©c</td>'
    + '<td style="padding:8px 0;font-size:14px;font-weight:700;">'
    + '<span style="background:' + badgeBg + ';color:#fff;padding:4px 12px;border-radius:999px;font-size:12px;">' + badgeText + '</span>'
    + '</td></tr>'
    + '</table></td></tr></table>'
    + '<p style="color:#71717a;font-size:13px;margin:24px 0 0;line-height:1.6;">ChÃºng tÃ´i sáº½ gá»­i thÃªm thÃ´ng tin chi tiáº¿t trÆ°á»›c ngÃ y há»c. HÃ£y theo dÃµi email nhÃ©!</p>';

  var html = getEmailTemplate(title, contentHtml, "", "");

  try {
    GmailApp.sendEmail(toEmail, subject, "Vui lÃ²ng xem email nÃ y trÃªn trÃ¬nh duyá»‡t há»— trá»£ HTML.", { htmlBody: html });
    Logger.log("ðŸ“§ Email HTML gá»­i thÃ nh cÃ´ng tá»›i: " + toEmail);
  } catch (err) {
    Logger.log("âš ï¸ Lá»—i gá»­i email: " + err.message);
  }
}

/**
 * Gá»­i email thÃ´ng bÃ¡o tiáº¿n Ä‘á»™ referral (khi cÃ³ 1 ngÆ°á»i Ä‘Äƒng kÃ½ qua link)
 */
function sendReferralProgressEmail(toEmail, name, currentCount, refCode) {
  var subject = "ðŸ”¥ CÃ³ ngÆ°á»i Ä‘Äƒng kÃ½ qua link cá»§a báº¡n!";
  var remaining = 2 - currentCount;
  var siteUrl = "https://ai-funnel-course.vercel.app";
  var progressWidth = (currentCount * 50) + "%";

  var contentHtml = '<p style="color:#fafafa;font-size:16px;margin:0 0 20px;line-height:1.6;">Xin chÃ o <strong>' + name + '</strong>,</p>'
    + '<p style="color:#d4d4d8;font-size:15px;margin:0 0 24px;line-height:1.7;">'
    + 'Tin vui! ðŸŽ‰ CÃ³ <strong style="color:#ff3366;">1 ngÆ°á»i</strong> vá»«a Ä‘Äƒng kÃ½ khÃ³a há»c qua link giá»›i thiá»‡u cá»§a báº¡n!</p>'
    // Progress Card
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#27272a;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">'
    + '<tr><td style="padding:24px;">'
    + '<p style="color:#a1a1aa;font-size:13px;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Tiáº¿n Ä‘á»™ giá»›i thiá»‡u</p>'
    // Progress Bar
    + '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">'
    + '<tr><td style="background-color:#3f3f46;border-radius:999px;height:8px;padding:0;">'
    + '<div style="background:linear-gradient(90deg,#ff3366,#ff7733);border-radius:999px;height:8px;width:' + progressWidth + ';"></div>'
    + '</td></tr></table>'
    + '<table width="100%" cellpadding="0" cellspacing="0">'
    + '<tr><td style="color:#fafafa;font-size:28px;font-weight:800;">' + currentCount + '<span style="color:#71717a;font-size:16px;font-weight:400;"> / 2</span></td>'
    + '<td style="text-align:right;color:#ff7733;font-size:14px;font-weight:600;">CÃ²n ' + remaining + ' ngÆ°á»i ná»¯a!</td></tr>'
    + '</table></td></tr></table>'
    + '<p style="color:#d4d4d8;font-size:15px;margin:24px 0 8px;line-height:1.7;">'
    + 'Chá»‰ cáº§n má»i thÃªm <strong style="color:#ff7733;">' + remaining + ' ngÆ°á»i</strong> ná»¯a, báº¡n sáº½ nháº­n ngay <strong style="color:#22c55e;">VÃ© Miá»…n PhÃ­</strong> tham gia khÃ³a há»c! ðŸš€</p>'
    + '<p style="color:#71717a;font-size:13px;margin:0;line-height:1.6;">Chia sáº» link bÃªn dÆ°á»›i cho báº¡n bÃ¨ Ä‘á»ƒ hoÃ n thÃ nh thá»­ thÃ¡ch nhÃ©!</p>';

  var referralLink = siteUrl + "?ref=" + refCode;
  var html = getEmailTemplate("Báº¡n cÃ³ 1 Referral má»›i! ðŸ”¥", contentHtml, "Chia sáº» link ngay", referralLink);

  try {
    GmailApp.sendEmail(toEmail, subject, "Vui lÃ²ng xem email nÃ y trÃªn trÃ¬nh duyá»‡t há»— trá»£ HTML.", { htmlBody: html });
    Logger.log("ðŸ“§ Referral progress email gá»­i tá»›i: " + toEmail);
  } catch (err) {
    Logger.log("âš ï¸ Lá»—i gá»­i referral progress email: " + err.message);
  }
}

// ============================================================
// HELPER
// ============================================================
function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
