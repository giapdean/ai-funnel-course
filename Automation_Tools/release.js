const fs = require('fs');
const path = require('path');
const shell = require('shelljs');

// === CONFIGURATION ===
const ROOT_DIR = path.join(__dirname, '..');
const PROJECT_CONFIG_PATH = path.join(ROOT_DIR, 'project.config.json');
const SRC_GAS_SCRIPT = path.join(ROOT_DIR, 'Source_Code', 'Google_Apps_Script', 'Code.gs');
const DEST_GAS_SCRIPT = path.join(ROOT_DIR, 'deploy_gas', 'Code.gs');
const DEPLOY_DIR = path.join(ROOT_DIR, 'deploy_gas');

console.log('🚀 Bắt đầu quá trình Deploy Google Apps Script...');

// 1. Kiểm tra môi trường
if (!shell.which('clasp')) {
    shell.echo('❌ Lỗi: "clasp" chưa được cài đặt (npm install -g @google/clasp).');
    shell.exit(1);
}

// 2. Tải cấu hình project
if (!fs.existsSync(PROJECT_CONFIG_PATH)) {
    shell.echo('❌ Lỗi: Không tìm thấy file project.config.json tại root.');
    shell.exit(1);
}

const config = JSON.parse(fs.readFileSync(PROJECT_CONFIG_PATH, 'utf8'));
const deploymentId = config.gas.deploymentId;

if (!deploymentId) {
    shell.echo('❌ Lỗi: Không tìm thấy gas.deploymentId trong project.config.json');
    shell.exit(1);
}

console.log(`📌 Deployment ID hiện tại: ${deploymentId}`);

// 3. Copy source code sang thư mục deploy_gas
console.log('\ud83d\udcc2 Đang copy Code.gs + Report.html (Source_Code -> deploy_gas)...');
fs.copyFileSync(SRC_GAS_SCRIPT, DEST_GAS_SCRIPT);
// Copy Report.html (sidebar) nếu tồn tại
const SRC_REPORT = path.join(ROOT_DIR, 'Source_Code', 'Google_Apps_Script', 'Report.html');
const DEST_REPORT = path.join(DEPLOY_DIR, 'Report.html');
if (fs.existsSync(SRC_REPORT)) {
    fs.copyFileSync(SRC_REPORT, DEST_REPORT);
}

// 4. Chạy Clasp Push và Deploy cập nhật phiên bản
console.log('☁️ Đang đẩy code lên Google Apps Script (clasp push)...');
if (shell.exec(`cd "${DEPLOY_DIR}" && clasp push --force`).code !== 0) {
    shell.echo('❌ Lỗi: Không thể push code lên Apps Script.');
    shell.exit(1);
}

console.log(`🔄 Đang xuất bản phiên bản mới cho Deployment ID: ${deploymentId}...`);
if (shell.exec(`cd "${DEPLOY_DIR}" && clasp deploy -i ${deploymentId} -d "Updated at ${new Date().toLocaleString()}"`).code !== 0) {
    shell.echo('❌ Lỗi: "clasp deploy" thất bại.');
    shell.exit(1);
}

console.log('✅ Deploy hoàn tất thành công! Frontend không cần đổi link URL.');
console.log(`🔗 API URL hiện tại: ${config.gas.webAppUrl}`);
