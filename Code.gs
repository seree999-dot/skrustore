/**
 * ============================================================================
 * ระบบบริหารจัดการร้านค้าในมหาวิทยาลัยราชภัฏสงขลา (SKRU Tenant & Shop Management System)
 * งานบริหารทรัพย์สินและสิทธิประโยชน์ / กองกลาง มหาวิทยาลัยราชภัฏสงขลา
 * ============================================================================
 * Google Sheet ID: 1FcbBW1QQb0Eo03snwIwE2UKb1gzpqtu1ljPgRQalCrA
 * GitHub Repo:     https://github.com/seree999-dot/skrustore.git
 */

const SPREADSHEET_ID = '1FcbBW1QQb0Eo03snwIwE2UKb1gzpqtu1ljPgRQalCrA';

const SHEET_NAMES = {
  USERS: 'Users',
  ZONES: 'Zones',
  SPACES: 'Spaces',
  SHOPS: 'Shops',
  CONTRACTS: 'Contracts',
  BILLINGS: 'Billings',
  SETTINGS: 'Settings',
  AUDIT_LOGS: 'Audit_Logs'
};

/**
 * Web App Entry Point (GET)
 * รองรับทั้งการเปิดหน้าเว็บผ่าน Google Apps Script HtmlService
 * และการเรียกข้อมูลแบบ JSON API (?action=...) จาก GitHub Pages
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    try {
      const action = e.parameter.action;
      const userEmail = e.parameter.userEmail || '';
      const payload = e.parameter.payload ? JSON.parse(e.parameter.payload) : {};
      const result = handleApiRequest(action, payload, userEmail);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, data: result }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('ระบบบริหารจัดการร้านค้า มหาวิทยาลัยราชภัฏสงขลา (SKRU Store Management)')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Web App Entry Point (POST)
 * รองรับการส่งข้อมูลจาก Frontend ที่รันบน GitHub Pages หรือ External Client
 */
function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const action = body.action;
    const payload = body.payload || {};
    const userEmail = body.userEmail || '';
    const result = handleApiRequest(action, payload, userEmail);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ฟังก์ชันหลักสำหรับเรียกผ่าน google.script.run
 */
function executeApi(action, payload, userEmail) {
  return handleApiRequest(action, payload || {}, userEmail || '');
}

/**
 * ตัวกระจายคำสั่ง API (Dispatcher) สำหรับทั้ง google.script.run และ HTTP Fetch
 */
function handleApiRequest(action, payload, userEmail) {
  switch (action) {
    case 'initDatabase':
      return initDatabase();
    case 'loginWithGoogleMockup':
      return loginWithGoogleMockup(payload.email || userEmail);
    case 'getInitialAppData':
      return getInitialAppData(userEmail);
    case 'saveZone':
      return saveZone(payload, userEmail);
    case 'saveSpace':
      return saveSpace(payload, userEmail);
    case 'saveShop':
      return saveShop(payload, userEmail);
    case 'saveContract':
      return saveContract(payload, userEmail);
    case 'updateContractStatus':
      return updateContractStatus(payload.contract_id, payload.status, payload.note, userEmail);
    case 'saveBilling':
      return saveBilling(payload, userEmail);
    case 'recordPayment':
      return recordPayment(payload, userEmail);
    case 'saveUserAllowlist':
      return saveUserAllowlist(payload, userEmail);
    case 'saveSystemSettings':
      return saveSystemSettings(payload, userEmail);
    case 'sendContractExpiryAlerts':
      return sendContractExpiryAlerts(userEmail);
    case 'generateContractDocument':
      return generateContractDocument(payload.contract_id, userEmail);
    default:
      throw new Error('ไม่พบคำสั่ง API ที่ระบุ: ' + action);
  }
}

/**
 * เชื่อมต่อ Google Spreadsheet ตาม SPREADSHEET_ID
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * ตรวจสอบและสร้างตารางฐานข้อมูลเริ่มต้นทั้งหมดใน Google Sheets อัตโนมัติ
 */
function initDatabase() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet();
    const now = new Date().toISOString();

    // 1. Users Sheet (Allowlist สำหรับ Google Login)
    ensureSheetWithSeed(
      ss,
      SHEET_NAMES.USERS,
      ['user_id', 'email', 'full_name', 'role', 'department', 'status', 'avatar_color', 'updated_at'],
      [
        ['USR-001', 'admin.property@skru.ac.th', 'คุณสมศักดิ์ ดูแลทรัพย์สิน (Admin)', 'ADMIN', 'งานบริหารทรัพย์สินและสิทธิประโยชน์', 'ACTIVE', '#b91c1c', now],
        ['USR-002', 'staff.central@skru.ac.th', 'คุณวิภาวรรณ กองกลาง (Staff)', 'STAFF', 'กองกลาง สำนักงานอธิการบดี', 'ACTIVE', '#0f766e', now],
        ['USR-003', 'utility.officer@skru.ac.th', 'คุณณัฐพล จดมิเตอร์ (Staff)', 'STAFF', 'งานสาธารณูปโภคและอาคารสถานที่', 'ACTIVE', '#1d4ed8', now]
      ]
    );

    // 2. Settings Sheet
    ensureSheetWithSeed(
      ss,
      SHEET_NAMES.SETTINGS,
      ['setting_key', 'setting_value', 'description', 'updated_at'],
      [
        ['UNIVERSITY_NAME', 'มหาวิทยาลัยราชภัฏสงขลา (Songkhla Rajabhat University)', 'ชื่อหน่วยงาน', now],
        ['DEPARTMENT_NAME', 'งานบริหารทรัพย์สินและสิทธิประโยชน์ กองกลาง สำนักงานอธิการบดี', 'หน่วยงานผู้ดูแล', now],
        ['WATER_RATE', '15', 'อัตราค่าน้ำประปา (บาท/หน่วย)', now],
        ['ELECTRIC_RATE', '5', 'อัตราค่าไฟฟ้า (บาท/หน่วย)', now],
        ['GARBAGE_FEE_DEFAULT', '150', 'ค่าจัดการขยะและส่วนกลางมาตรฐาน (บาท/เดือน)', now],
        ['EXPIRY_WARNING_DAYS', '30', 'จำนวนวันแจ้งเตือนล่วงหน้าก่อนสัญญาหมดอายุ (วัน)', now],
        ['DRIVE_FOLDER_ID', '', 'Google Drive Folder ID สำหรับเก็บไฟล์สัญญาและใบเสร็จ (เว้นว่างเพื่อสร้างอัตโนมัติ)', now]
      ]
    );

    // 3. Zones Sheet
    ensureSheetWithSeed(
      ss,
      SHEET_NAMES.ZONES,
      ['zone_id', 'zone_code', 'zone_name', 'location_detail', 'total_capacity', 'status', 'updated_at', 'updated_by'],
      [
        ['ZN-01', 'CANTEEN-MAIN', 'โรงอาหารกลาง (ริมคลอง)', 'อาคารโรงอาหารกลาง ติดคลองสำโรง มรภ.สงขลา', 20, 'ACTIVE', now, 'admin.property@skru.ac.th'],
        ['ZN-02', 'CANTEEN-FMS', 'ศูนย์อาหารคณะวิทยาการจัดการ', 'ชั้น 1 อาคารคณะวิทยาการจัดการ', 10, 'ACTIVE', now, 'admin.property@skru.ac.th'],
        ['ZN-03', 'BLDG-COMPLEX', 'อาคารเรียนรวมและปฏิบัติการ', 'พื้นที่โถงชั้น 1 อาคารเรียนรวม (ร้านกาแฟ/ถ่ายเอกสาร)', 8, 'ACTIVE', now, 'admin.property@skru.ac.th'],
        ['ZN-04', 'KIOSK-SPORT', 'ซุ้มร้านค้าสวัสดิการและสนามกีฬา', 'บริเวณข้างสนามกีฬากลางและหอพักนักศึกษา', 6, 'ACTIVE', now, 'admin.property@skru.ac.th']
      ]
    );

    // 4. Spaces (Booths) Sheet
    ensureSheetWithSeed(
      ss,
      SHEET_NAMES.SPACES,
      ['space_id', 'space_code', 'zone_id', 'space_name', 'size_sqm', 'standard_rent', 'water_meter_no', 'last_water_reading', 'elec_meter_no', 'last_elec_reading', 'status', 'updated_at', 'updated_by'],
      [
        ['SPC-001', 'C1-A01', 'ZN-01', 'ล็อกอาหารตามสั่ง A01', 12, 3500, 'WM-101', 240, 'EM-101', 1520, 'OCCUPIED', now, 'admin.property@skru.ac.th'],
        ['SPC-002', 'C1-A02', 'ZN-01', 'ล็อกข้าวแกงปักษ์ใต้ A02', 12, 3500, 'WM-102', 310, 'EM-102', 1890, 'OCCUPIED', now, 'admin.property@skru.ac.th'],
        ['SPC-003', 'C1-A03', 'ZN-01', 'ล็อกก๋วยเตี๋ยวเรือ A03', 12, 3500, 'WM-103', 180, 'EM-103', 980, 'AVAILABLE', now, 'admin.property@skru.ac.th'],
        ['SPC-004', 'C1-B01', 'ZN-01', 'ล็อกเครื่องดื่มและผลไม้ B01', 9, 2800, 'WM-104', 410, 'EM-104', 2150, 'OCCUPIED', now, 'admin.property@skru.ac.th'],
        ['SPC-005', 'FMS-01', 'ZN-02', 'ล็อกเบเกอรีและของว่าง FMS-01', 10, 3000, 'WM-201', 95, 'EM-201', 1340, 'OCCUPIED', now, 'admin.property@skru.ac.th'],
        ['SPC-006', 'FMS-02', 'ZN-02', 'ล็อกอาหารฮาลาล FMS-02', 12, 3200, 'WM-202', 120, 'EM-202', 870, 'AVAILABLE', now, 'admin.property@skru.ac.th'],
        ['SPC-007', 'BLD-K01', 'ZN-03', 'พื้นที่ร้านกาแฟสด อาคารเรียนรวม', 16, 5500, 'WM-301', 520, 'EM-301', 4300, 'OCCUPIED', now, 'admin.property@skru.ac.th'],
        ['SPC-008', 'BLD-K02', 'ZN-03', 'ศูนย์ถ่ายเอกสารและเครื่องเขียน', 20, 4500, 'WM-302', 45, 'EM-302', 3890, 'MAINTENANCE', now, 'admin.property@skru.ac.th']
      ]
    );

    // 5. Shops (Tenants) Sheet
    ensureSheetWithSeed(
      ss,
      SHEET_NAMES.SHOPS,
      ['shop_id', 'shop_code', 'shop_name', 'category', 'owner_name', 'citizen_id', 'phone', 'email_or_line', 'status', 'updated_at', 'updated_by'],
      [
        ['SHP-001', 'SKRU-S001', 'ร้านป้าพร อาหารตามสั่ง', 'อาหารตามสั่ง', 'นางสมพร รักสงขลา', '1909800123456', '081-234-5678', 'line:paporn_food', 'ACTIVE', now, 'admin.property@skru.ac.th'],
        ['SHP-002', 'SKRU-S002', 'ครัวปักษ์ใต้ นครศรีฯ', 'ข้าวราดแกง', 'นายสุชาติ ทองดี', '1809900456789', '089-876-5432', 'line:suchart_curry', 'ACTIVE', now, 'admin.property@skru.ac.th'],
        ['SHP-003', 'SKRU-S003', 'สดชื่นสมูทตี้ & ชานมไข่มุก', 'เครื่องดื่ม/ของหวาน', 'นางสาวกานดา สดใส', '1900100789123', '086-111-2233', 'kanda.drink@gmail.com', 'ACTIVE', now, 'admin.property@skru.ac.th'],
        ['SHP-004', 'SKRU-S004', 'บ้านขนมปังโฮมเมด FMS', 'เบเกอรี/ของว่าง', 'นางสาวพิมพ์ชนก ใจดี', '1900200321654', '092-333-4455', 'line:pim_bakery', 'ACTIVE', now, 'admin.property@skru.ac.th'],
        ['SHP-005', 'SKRU-S005', 'SKRU Aroma Coffee', 'ร้านกาแฟสด', 'นายธนกฤต กาแฟหอม', '1909900987654', '084-555-6677', 'thanakrit.cafe@gmail.com', 'ACTIVE', now, 'admin.property@skru.ac.th']
      ]
    );

    // 6. Contracts Sheet (มีทั้งสัญญาปกติ, สัญญาใกล้หมดอายุ <= 30 วัน, และสัญญาหมดอายุแล้วเพื่อทดสอบระบบแจ้งเตือน)
    ensureSheetWithSeed(
      ss,
      SHEET_NAMES.CONTRACTS,
      ['contract_id', 'contract_no', 'shop_id', 'space_id', 'start_date', 'end_date', 'monthly_rent', 'deposit_amount', 'water_flat_fee', 'elec_flat_fee', 'contract_file_url', 'status', 'note', 'updated_at', 'updated_by'],
      [
        ['CNT-001', 'SKRU-69/001', 'SHP-001', 'SPC-001', '2026-01-01', '2026-12-31', 3500, 7000, 0, 0, 'https://drive.google.com/file/d/mock-contract-001/view', 'ACTIVE', 'สัญญาเช่ารายปี โรงอาหารกลาง', now, 'admin.property@skru.ac.th'],
        ['CNT-002', 'SKRU-69/002', 'SHP-002', 'SPC-002', '2025-11-01', '2026-10-28', 3500, 7000, 0, 0, 'https://drive.google.com/file/d/mock-contract-002/view', 'ACTIVE', 'ใกล้หมดสัญญาภายในเดือนตุลาคม 2026', now, 'admin.property@skru.ac.th'],
        ['CNT-003', 'SKRU-69/003', 'SHP-003', 'SPC-004', '2025-11-05', '2026-11-04', 2800, 5600, 0, 0, 'https://drive.google.com/file/d/mock-contract-003/view', 'ACTIVE', 'ใกล้หมดสัญญา ต้องแจ้งผู้เช่าล่วงหน้า', now, 'admin.property@skru.ac.th'],
        ['CNT-004', 'SKRU-69/004', 'SHP-004', 'SPC-005', '2025-10-01', '2026-09-30', 3000, 6000, 0, 0, 'https://drive.google.com/file/d/mock-contract-004/view', 'ACTIVE', 'เลยกำหนดวันสิ้นสุดสัญญา รอดำเนินการต่อสัญญา', now, 'admin.property@skru.ac.th'],
        ['CNT-005', 'SKRU-69/005', 'SHP-005', 'SPC-007', '2026-06-01', '2027-05-31', 5500, 15000, 0, 0, 'https://drive.google.com/file/d/mock-contract-005/view', 'ACTIVE', 'สัญญาร้านกาแฟสด อาคารเรียนรวม', now, 'admin.property@skru.ac.th']
      ]
    );

    // 7. Billings Sheet (รายการค่าเช่าและค่าน้ำ-ค่าไฟรายเดือน)
    ensureSheetWithSeed(
      ss,
      SHEET_NAMES.BILLINGS,
      [
        'billing_id', 'invoice_no', 'billing_month', 'contract_id', 'shop_id', 'space_id',
        'rent_amount', 'water_prev', 'water_curr', 'water_units', 'water_rate', 'water_amount',
        'elec_prev', 'elec_curr', 'elec_units', 'elec_rate', 'elec_amount',
        'other_fee', 'discount', 'total_amount', 'payment_status', 'paid_date', 'receipt_no', 'slip_file_url',
        'updated_at', 'updated_by'
      ],
      [
        [
          'BIL-202610-001', 'INV-6910-001', '2026-10', 'CNT-001', 'SHP-001', 'SPC-001',
          3500, 225, 240, 15, 15, 225,
          1400, 1520, 120, 5, 600,
          150, 0, 4475, 'PAID', '2026-10-05', 'RC-SKRU-691001', 'https://drive.google.com/file/d/mock-slip-001/view',
          now, 'staff.central@skru.ac.th'
        ],
        [
          'BIL-202610-002', 'INV-6910-002', '2026-10', 'CNT-002', 'SHP-002', 'SPC-002',
          3500, 290, 310, 20, 15, 300,
          1750, 1890, 140, 5, 700,
          150, 0, 4650, 'PENDING', '', '', '',
          now, 'utility.officer@skru.ac.th'
        ],
        [
          'BIL-202610-003', 'INV-6910-003', '2026-10', 'CNT-003', 'SHP-003', 'SPC-004',
          2800, 392, 410, 18, 15, 270,
          2010, 2150, 140, 5, 700,
          150, 0, 3920, 'PAID', '2026-10-08', 'RC-SKRU-691002', 'https://drive.google.com/file/d/mock-slip-002/view',
          now, 'staff.central@skru.ac.th'
        ],
        [
          'BIL-202610-004', 'INV-6910-004', '2026-10', 'CNT-005', 'SHP-005', 'SPC-007',
          5500, 495, 520, 25, 15, 375,
          3980, 4300, 320, 5, 1600,
          150, 0, 7625, 'PENDING', '', '', '',
          now, 'utility.officer@skru.ac.th'
        ]
      ]
    );

    // 8. Audit Logs Sheet
    ensureSheetWithSeed(
      ss,
      SHEET_NAMES.AUDIT_LOGS,
      ['log_id', 'timestamp', 'actor_email', 'action_type', 'module', 'target_id', 'detail'],
      [
        ['LOG-0001', now, 'admin.property@skru.ac.th', 'INIT_DB', 'SYSTEM', 'ALL', 'เริ่มต้นโครงสร้างฐานข้อมูลระบบบริหารจัดการร้านค้า มรภ.สงขลา']
      ]
    );

    return { initialized: true, spreadsheetId: SPREADSHEET_ID };
  } finally {
    lock.releaseLock();
  }
}

/**
 * สร้างชีตและข้อมูลตั้งต้นหากยังไม่มีชีตในไฟล์ Google Sheets
 */
function ensureSheetWithSeed(ss, sheetName, headers, seedRows) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#881337')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);

    if (seedRows && seedRows.length > 0) {
      sheet.getRange(2, 1, seedRows.length, headers.length).setValues(seedRows);
    }
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    if (seedRows && seedRows.length > 0) {
      sheet.getRange(2, 1, seedRows.length, headers.length).setValues(seedRows);
    }
  }
  return sheet;
}

/**
 * อ่านข้อมูลจากชีตทั้งหมดแปลงเป็น Array of Objects (Batch Read ตาม NFR-PERF-01)
 */
function getSheetDataAsObjects(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const result = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(cell => cell === '' || cell === null)) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      let val = row[idx];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, 'Asia/Bangkok', 'yyyy-MM-dd');
      }
      obj[h] = val;
    });
    result.push(obj);
  }
  return result;
}

/**
 * บันทึกประวัติการทำงานลงชีต Audit_Logs (ตาม NFR-AUD-01)
 */
function writeAuditLog(ss, actorEmail, actionType, moduleName, targetId, detail) {
  const sheet = ss.getSheetByName(SHEET_NAMES.AUDIT_LOGS);
  if (!sheet) return;
  const logId = 'LOG-' + new Date().getTime();
  const now = new Date().toISOString();
  sheet.appendRow([logId, now, actorEmail || 'system', actionType, moduleName, targetId, detail]);
}

/**
 * ตรวจสอบสิทธิ์ผู้ใช้งานด้วย Google Login / Allowlist (NFR-SEC-01 & BR-01)
 */
function requireAuthorizedUser(clientEmail, requiredRole) {
  const ss = getSpreadsheet();
  if (!ss.getSheetByName(SHEET_NAMES.USERS)) {
    initDatabase();
  }

  let sessionEmail = '';
  try {
    sessionEmail = Session.getActiveUser().getEmail();
  } catch (e) {
    sessionEmail = '';
  }

  const effectiveEmail = String(clientEmail || sessionEmail || '').trim().toLowerCase();
  if (!effectiveEmail) {
    throw new Error('กรุณาเข้าสู่ระบบด้วยบัญชี Google ก่อนใช้งาน (UNAUTHORIZED_NO_EMAIL)');
  }

  const users = getSheetDataAsObjects(ss, SHEET_NAMES.USERS);
  const matchedUser = users.find(u => String(u.email).trim().toLowerCase() === effectiveEmail);

  if (!matchedUser) {
    throw new Error('บัญชี Google (' + effectiveEmail + ') ไม่มีรายชื่อในระบบผู้ดูแล (Allowlist) กรุณาติดต่อผู้ดูแลระบบงานบริหารทรัพย์สิน มรภ.สงขลา');
  }

  if (String(matchedUser.status).toUpperCase() !== 'ACTIVE') {
    throw new Error('บัญชีผู้ใช้งาน (' + effectiveEmail + ') ถูกระงับสิทธิ์ชั่วคราว (INACTIVE)');
  }

  if (requiredRole === 'ADMIN' && String(matchedUser.role).toUpperCase() !== 'ADMIN') {
    throw new Error('คำสั่งนี้จำกัดเฉพาะผู้ดูแลระบบระดับ ADMIN เท่านั้น');
  }

  return matchedUser;
}

/**
 * ฟังก์ชันเข้าสู่ระบบด้วย Google Login (รองรับทั้ง Google Session และ Google Login Mockup)
 */
function loginWithGoogleMockup(emailInput) {
  const ss = getSpreadsheet();
  if (!ss.getSheetByName(SHEET_NAMES.USERS)) {
    initDatabase();
  }
  const user = requireAuthorizedUser(emailInput);
  writeAuditLog(ss, user.email, 'LOGIN', 'AUTH', user.user_id, 'เข้าสู่ระบบด้วย Google Login สำเร็จ (' + user.role + ')');
  return user;
}

/**
 * ดึงข้อมูลทั้งหมดของระบบในครั้งเดียว (Batch Read) เพื่อแสดงผลบน Dashboard และทุกโมดูล
 */
function getInitialAppData(userEmail) {
  const ss = getSpreadsheet();
  if (!ss.getSheetByName(SHEET_NAMES.USERS)) {
    initDatabase();
  }

  const currentUser = requireAuthorizedUser(userEmail);
  const settingsRows = getSheetDataAsObjects(ss, SHEET_NAMES.SETTINGS);
  const settings = {};
  settingsRows.forEach(r => {
    settings[r.setting_key] = r.setting_value;
  });

  const zones = getSheetDataAsObjects(ss, SHEET_NAMES.ZONES);
  const spaces = getSheetDataAsObjects(ss, SHEET_NAMES.SPACES);
  const shops = getSheetDataAsObjects(ss, SHEET_NAMES.SHOPS);
  const contracts = getSheetDataAsObjects(ss, SHEET_NAMES.CONTRACTS);
  const billings = getSheetDataAsObjects(ss, SHEET_NAMES.BILLINGS);
  const users = getSheetDataAsObjects(ss, SHEET_NAMES.USERS);
  const auditLogs = getSheetDataAsObjects(ss, SHEET_NAMES.AUDIT_LOGS).reverse().slice(0, 100);

  return {
    spreadsheetId: SPREADSHEET_ID,
    currentUser: currentUser,
    settings: settings,
    zones: zones,
    spaces: spaces,
    shops: shops,
    contracts: contracts,
    billings: billings,
    users: users,
    auditLogs: auditLogs
  };
}

/**
 * Helper: บันทึกหรืออัปเดตแถวในชีตตาม Primary Key
 */
function upsertRowByKey(ss, sheetName, keyColumn, keyValue, rowObj) {
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const keyIndex = headers.indexOf(keyColumn);

  const rowArray = headers.map(h => (rowObj[h] !== undefined && rowObj[h] !== null ? rowObj[h] : ''));

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][keyIndex]).trim() === String(keyValue).trim()) {
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([rowArray]);
      return { updated: true, rowNumber: i + 1 };
    }
  }

  sheet.appendRow(rowArray);
  return { updated: false, rowNumber: sheet.getLastRow() };
}

/**
 * อัปโหลดไฟล์ Base64 (สัญญาเช่า PDF หรือรูปสลิป) ไปยัง Google Drive
 */
function uploadFileToDriveIfPresent(base64Data, fileName, mimeType) {
  if (!base64Data || !String(base64Data).startsWith('data:')) {
    return base64Data || '';
  }
  try {
    const parts = base64Data.split(',');
    const byteCharacters = Utilities.base64Decode(parts[1]);
    const blob = Utilities.newBlob(byteCharacters, mimeType || 'application/pdf', fileName || ('SKRU_FILE_' + new Date().getTime()));
    const file = DriveApp.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    return 'https://drive.google.com/file/d/local-upload-' + encodeURIComponent(fileName || 'document') + '/view';
  }
}

/**
 * 1. บันทึก/แก้ไขโซนพื้นที่ (FR-ZONE-01)
 */
function saveZone(zoneData, userEmail) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const user = requireAuthorizedUser(userEmail);
    const ss = getSpreadsheet();
    const now = new Date().toISOString();
    const zoneId = zoneData.zone_id || ('ZN-' + new Date().getTime().toString().slice(-5));

    const record = {
      zone_id: zoneId,
      zone_code: String(zoneData.zone_code || '').trim().toUpperCase(),
      zone_name: String(zoneData.zone_name || '').trim(),
      location_detail: String(zoneData.location_detail || '').trim(),
      total_capacity: Number(zoneData.total_capacity || 0),
      status: zoneData.status || 'ACTIVE',
      updated_at: now,
      updated_by: user.email
    };

    if (!record.zone_code || !record.zone_name) {
      throw new Error('กรุณาระบุรหัสโซนและชื่อโซนพื้นที่ให้ครบถ้วน');
    }

    upsertRowByKey(ss, SHEET_NAMES.ZONES, 'zone_id', zoneId, record);
    writeAuditLog(ss, user.email, 'SAVE_ZONE', 'ZONES', zoneId, 'บันทึกโซนพื้นที่: ' + record.zone_name);
    return record;
  } finally {
    lock.releaseLock();
  }
}

/**
 * 2. บันทึก/แก้ไขล็อกพื้นที่เช่า (FR-ZONE-02 & AC-02.2 ป้องกันรหัสล็อกซ้ำ)
 */
function saveSpace(spaceData, userEmail) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const user = requireAuthorizedUser(userEmail);
    const ss = getSpreadsheet();
    const now = new Date().toISOString();
    const spaces = getSheetDataAsObjects(ss, SHEET_NAMES.SPACES);

    const spaceCode = String(spaceData.space_code || '').trim().toUpperCase();
    if (!spaceCode || !spaceData.zone_id) {
      throw new Error('กรุณาระบุรหัสล็อกพื้นที่และเลือกโซนให้ครบถ้วน');
    }

    const duplicate = spaces.find(
      s => String(s.space_code).trim().toUpperCase() === spaceCode && s.space_id !== spaceData.space_id
    );
    if (duplicate) {
      throw new Error('รหัสล็อกพื้นที่ (' + spaceCode + ') มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น');
    }

    const spaceId = spaceData.space_id || ('SPC-' + new Date().getTime().toString().slice(-5));
    const record = {
      space_id: spaceId,
      space_code: spaceCode,
      zone_id: spaceData.zone_id,
      space_name: String(spaceData.space_name || '').trim(),
      size_sqm: Number(spaceData.size_sqm || 0),
      standard_rent: Number(spaceData.standard_rent || 0),
      water_meter_no: String(spaceData.water_meter_no || '').trim(),
      last_water_reading: Number(spaceData.last_water_reading || 0),
      elec_meter_no: String(spaceData.elec_meter_no || '').trim(),
      last_elec_reading: Number(spaceData.last_elec_reading || 0),
      status: spaceData.status || 'AVAILABLE',
      updated_at: now,
      updated_by: user.email
    };

    upsertRowByKey(ss, SHEET_NAMES.SPACES, 'space_id', spaceId, record);
    writeAuditLog(ss, user.email, 'SAVE_SPACE', 'SPACES', spaceId, 'บันทึกล็อกพื้นที่: ' + spaceCode + ' (' + record.status + ')');
    return record;
  } finally {
    lock.releaseLock();
  }
}

/**
 * 3. บันทึก/แก้ไขข้อมูลร้านค้าและผู้ประกอบการ (FR-SHOP-01)
 */
function saveShop(shopData, userEmail) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const user = requireAuthorizedUser(userEmail);
    const ss = getSpreadsheet();
    const now = new Date().toISOString();
    const shopId = shopData.shop_id || ('SHP-' + new Date().getTime().toString().slice(-5));

    const record = {
      shop_id: shopId,
      shop_code: String(shopData.shop_code || ('SKRU-' + shopId)).trim().toUpperCase(),
      shop_name: String(shopData.shop_name || '').trim(),
      category: String(shopData.category || 'อาหารตามสั่ง').trim(),
      owner_name: String(shopData.owner_name || '').trim(),
      citizen_id: String(shopData.citizen_id || '').trim(),
      phone: String(shopData.phone || '').trim(),
      email_or_line: String(shopData.email_or_line || '').trim(),
      status: shopData.status || 'ACTIVE',
      updated_at: now,
      updated_by: user.email
    };

    if (!record.shop_name || !record.owner_name) {
      throw new Error('กรุณาระบุชื่อร้านค้าและชื่อ-นามสกุลผู้ประกอบการ');
    }

    upsertRowByKey(ss, SHEET_NAMES.SHOPS, 'shop_id', shopId, record);
    writeAuditLog(ss, user.email, 'SAVE_SHOP', 'SHOPS', shopId, 'บันทึกร้านค้า: ' + record.shop_name);
    return record;
  } finally {
    lock.releaseLock();
  }
}

/**
 * 4. บันทึก/ต่อสัญญาเช่าพื้นที่ (FR-CONT-01..04, BR-02, BR-04)
 */
function saveContract(contractData, userEmail) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const user = requireAuthorizedUser(userEmail);
    const ss = getSpreadsheet();
    const now = new Date().toISOString();

    if (!contractData.shop_id || !contractData.space_id || !contractData.start_date || !contractData.end_date) {
      throw new Error('กรุณาระบุร้านค้า ล็อกพื้นที่ วันเริ่มสัญญา และวันสิ้นสุดสัญญาให้ครบถ้วน');
    }

    if (new Date(contractData.end_date) <= new Date(contractData.start_date)) {
      throw new Error('วันสิ้นสุดสัญญาต้องมากกว่าวันเริ่มสัญญา (AC-03.2)');
    }

    const contracts = getSheetDataAsObjects(ss, SHEET_NAMES.CONTRACTS);
    const spaces = getSheetDataAsObjects(ss, SHEET_NAMES.SPACES);
    const targetSpace = spaces.find(s => s.space_id === contractData.space_id);

    if (!targetSpace) {
      throw new Error('ไม่พบข้อมูลล็อกพื้นที่ที่เลือก');
    }

    // หากเป็นการต่อสัญญาเดิม (renew_from_contract_id) ให้ปิดสัญญาเดิมก่อน
    if (contractData.renew_from_contract_id) {
      const oldContract = contracts.find(c => c.contract_id === contractData.renew_from_contract_id);
      if (oldContract) {
        oldContract.status = 'RENEWED';
        oldContract.updated_at = now;
        oldContract.updated_by = user.email;
        upsertRowByKey(ss, SHEET_NAMES.CONTRACTS, 'contract_id', oldContract.contract_id, oldContract);
      }
    } else {
      // ตรวจสอบ BR-02: ห้ามมีสัญญา ACTIVE ซ้ำซ้อนในล็อกเดียวกัน
      const conflictingContract = contracts.find(
        c => c.space_id === contractData.space_id &&
             c.status === 'ACTIVE' &&
             c.contract_id !== contractData.contract_id
      );
      if (conflictingContract) {
        throw new Error('ล็อกพื้นที่นี้มีสัญญาเช่าที่ยังใช้งานอยู่ (' + conflictingContract.contract_no + ') ห้ามทำสัญญาซ้ำซ้อน (BR-02)');
      }
    }

    const contractId = contractData.contract_id || ('CNT-' + new Date().getTime().toString().slice(-5));
    const fileUrl = uploadFileToDriveIfPresent(
      contractData.contract_file_data || contractData.contract_file_url,
      'Contract_' + (contractData.contract_no || contractId) + '.pdf',
      contractData.contract_file_mime || 'application/pdf'
    );

    const record = {
      contract_id: contractId,
      contract_no: String(contractData.contract_no || ('SKRU-' + contractId)).trim(),
      shop_id: contractData.shop_id,
      space_id: contractData.space_id,
      start_date: contractData.start_date,
      end_date: contractData.end_date,
      monthly_rent: Number(contractData.monthly_rent || targetSpace.standard_rent || 0),
      deposit_amount: Number(contractData.deposit_amount || 0),
      water_flat_fee: Number(contractData.water_flat_fee || 0),
      elec_flat_fee: Number(contractData.elec_flat_fee || 0),
      contract_file_url: fileUrl,
      status: contractData.status || 'ACTIVE',
      note: String(contractData.note || '').trim(),
      updated_at: now,
      updated_by: user.email
    };

    upsertRowByKey(ss, SHEET_NAMES.CONTRACTS, 'contract_id', contractId, record);

    // BR-04: ซิงค์สถานะล็อกพื้นที่อัตโนมัติ
    if (record.status === 'ACTIVE') {
      targetSpace.status = 'OCCUPIED';
      targetSpace.updated_at = now;
      targetSpace.updated_by = user.email;
      upsertRowByKey(ss, SHEET_NAMES.SPACES, 'space_id', targetSpace.space_id, targetSpace);
    }

    writeAuditLog(ss, user.email, 'SAVE_CONTRACT', 'CONTRACTS', contractId, 'บันทึกสัญญาเช่าเลขที่: ' + record.contract_no + ' ล็อก: ' + targetSpace.space_code);
    return record;
  } finally {
    lock.releaseLock();
  }
}

/**
 * เปลี่ยนสถานะสัญญาเช่า เช่น ยกเลิกสัญญา / ปิดสัญญา และคืนสถานะล็อกเป็น AVAILABLE (BR-04)
 */
function updateContractStatus(contractId, newStatus, note, userEmail) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const user = requireAuthorizedUser(userEmail);
    const ss = getSpreadsheet();
    const now = new Date().toISOString();
    const contracts = getSheetDataAsObjects(ss, SHEET_NAMES.CONTRACTS);
    const target = contracts.find(c => c.contract_id === contractId);

    if (!target) {
      throw new Error('ไม่พบสัญญาเช่าที่ระบุ');
    }

    target.status = newStatus;
    if (note) target.note = note;
    target.updated_at = now;
    target.updated_by = user.email;
    upsertRowByKey(ss, SHEET_NAMES.CONTRACTS, 'contract_id', contractId, target);

    // หากปิดหรือยกเลิกสัญญา และไม่มีสัญญา ACTIVE อื่นในล็อกนั้น ให้คืนสถานะล็อกเป็น AVAILABLE
    if (newStatus === 'CLOSED' || newStatus === 'TERMINATED') {
      const otherActive = contracts.find(
        c => c.space_id === target.space_id && c.contract_id !== contractId && c.status === 'ACTIVE'
      );
      if (!otherActive) {
        const spaces = getSheetDataAsObjects(ss, SHEET_NAMES.SPACES);
        const space = spaces.find(s => s.space_id === target.space_id);
        if (space) {
          space.status = 'AVAILABLE';
          space.updated_at = now;
          space.updated_by = user.email;
          upsertRowByKey(ss, SHEET_NAMES.SPACES, 'space_id', space.space_id, space);
        }
      }
    }

    writeAuditLog(ss, user.email, 'UPDATE_CONTRACT_STATUS', 'CONTRACTS', contractId, 'เปลี่ยนสถานะสัญญา ' + target.contract_no + ' เป็น ' + newStatus);
    return target;
  } finally {
    lock.releaseLock();
  }
}

/**
 * 5. บันทึกรายการแจ้งหนี้ค่าเช่าและมิเตอร์น้ำ-ไฟรายเดือน (FR-BILL-01..02, BR-05, BR-06)
 */
function saveBilling(billingData, userEmail) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const user = requireAuthorizedUser(userEmail);
    const ss = getSpreadsheet();
    const now = new Date().toISOString();

    const billings = getSheetDataAsObjects(ss, SHEET_NAMES.BILLINGS);
    const spaces = getSheetDataAsObjects(ss, SHEET_NAMES.SPACES);

    // BR-06: ป้องกันการออกบิลซ้ำในรอบเดือนเดียวกันสำหรับสัญญาเดียวกัน
    const duplicate = billings.find(
      b => b.contract_id === billingData.contract_id &&
           b.billing_month === billingData.billing_month &&
           b.billing_id !== billingData.billing_id
    );
    if (duplicate) {
      throw new Error('สัญญาเช่านี้มีการออกใบแจ้งยอดประจำเดือน ' + billingData.billing_month + ' ไปแล้ว (' + duplicate.invoice_no + ')');
    }

    const waterPrev = Number(billingData.water_prev || 0);
    const waterCurr = Number(billingData.water_curr || 0);
    const elecPrev = Number(billingData.elec_prev || 0);
    const elecCurr = Number(billingData.elec_curr || 0);
    const isMeterReset = Boolean(billingData.meter_reset);

    // AC-05.2: ตรวจสอบเลขมิเตอร์ต้องไม่น้อยกว่าครั้งก่อน (ยกเว้นเปลี่ยนมิเตอร์ใหม่)
    if (!isMeterReset && waterCurr < waterPrev) {
      throw new Error('เลขมิเตอร์น้ำปัจจุบัน (' + waterCurr + ') ต้องไม่น้อยกว่าเลขมิเตอร์ครั้งก่อน (' + waterPrev + ')');
    }
    if (!isMeterReset && elecCurr < elecPrev) {
      throw new Error('เลขมิเตอร์ไฟปัจจุบัน (' + elecCurr + ') ต้องไม่น้อยกว่าเลขมิเตอร์ครั้งก่อน (' + elecPrev + ')');
    }

    const waterUnits = isMeterReset ? Number(billingData.water_units || waterCurr) : (waterCurr - waterPrev);
    const elecUnits = isMeterReset ? Number(billingData.elec_units || elecCurr) : (elecCurr - elecPrev);
    const waterRate = Number(billingData.water_rate || 15);
    const elecRate = Number(billingData.elec_rate || 5);
    const rentAmount = Number(billingData.rent_amount || 0);
    const otherFee = Number(billingData.other_fee || 0);
    const discount = Number(billingData.discount || 0);

    const waterAmount = waterUnits * waterRate;
    const elecAmount = elecUnits * elecRate;
    const totalAmount = rentAmount + waterAmount + elecAmount + otherFee - discount;

    const billingId = billingData.billing_id || ('BIL-' + billingData.billing_month.replace('-', '') + '-' + new Date().getTime().toString().slice(-4));
    const invoiceNo = billingData.invoice_no || ('INV-' + billingData.billing_month.replace('-', '') + '-' + new Date().getTime().toString().slice(-3));

    const record = {
      billing_id: billingId,
      invoice_no: invoiceNo,
      billing_month: billingData.billing_month,
      contract_id: billingData.contract_id,
      shop_id: billingData.shop_id,
      space_id: billingData.space_id,
      rent_amount: rentAmount,
      water_prev: waterPrev,
      water_curr: waterCurr,
      water_units: waterUnits,
      water_rate: waterRate,
      water_amount: waterAmount,
      elec_prev: elecPrev,
      elec_curr: elecCurr,
      elec_units: elecUnits,
      elec_rate: elecRate,
      elec_amount: elecAmount,
      other_fee: otherFee,
      discount: discount,
      total_amount: totalAmount,
      payment_status: billingData.payment_status || 'PENDING',
      paid_date: billingData.paid_date || '',
      receipt_no: billingData.receipt_no || '',
      slip_file_url: billingData.slip_file_url || '',
      updated_at: now,
      updated_by: user.email
    };

    upsertRowByKey(ss, SHEET_NAMES.BILLINGS, 'billing_id', billingId, record);

    // อัปเดตเลขมิเตอร์ล่าสุดลงใน Spaces
    const space = spaces.find(s => s.space_id === billingData.space_id);
    if (space) {
      space.last_water_reading = waterCurr;
      space.last_elec_reading = elecCurr;
      space.updated_at = now;
      space.updated_by = user.email;
      upsertRowByKey(ss, SHEET_NAMES.SPACES, 'space_id', space.space_id, space);
    }

    writeAuditLog(ss, user.email, 'SAVE_BILLING', 'BILLINGS', billingId, 'บันทึกใบแจ้งหนี้ ' + invoiceNo + ' ยอดสุทธิ ' + totalAmount + ' บาท');
    return record;
  } finally {
    lock.releaseLock();
  }
}

/**
 * 6. บันทึกการรับชำระเงินและแนบหลักฐานใบเสร็จ/สลิป (FR-BILL-03)
 */
function recordPayment(paymentData, userEmail) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const user = requireAuthorizedUser(userEmail);
    const ss = getSpreadsheet();
    const now = new Date().toISOString();
    const billings = getSheetDataAsObjects(ss, SHEET_NAMES.BILLINGS);
    const target = billings.find(b => b.billing_id === paymentData.billing_id);

    if (!target) {
      throw new Error('ไม่พบรายการใบแจ้งหนี้ที่ต้องการบันทึกชำระเงิน');
    }

    const slipUrl = uploadFileToDriveIfPresent(
      paymentData.slip_file_data || paymentData.slip_file_url || target.slip_file_url,
      'Receipt_' + target.invoice_no + '.jpg',
      paymentData.slip_file_mime || 'image/jpeg'
    );

    target.payment_status = paymentData.payment_status || 'PAID';
    target.paid_date = paymentData.paid_date || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
    target.receipt_no = String(paymentData.receipt_no || '').trim();
    target.slip_file_url = slipUrl;
    target.updated_at = now;
    target.updated_by = user.email;

    upsertRowByKey(ss, SHEET_NAMES.BILLINGS, 'billing_id', target.billing_id, target);
    writeAuditLog(ss, user.email, 'RECORD_PAYMENT', 'BILLINGS', target.billing_id, 'รับชำระเงินใบแจ้งหนี้ ' + target.invoice_no + ' ใบเสร็จเลขที่ ' + target.receipt_no);
    return target;
  } finally {
    lock.releaseLock();
  }
}

/**
 * 7. จัดการรายชื่อผู้ใช้งานที่มีสิทธิ์เข้าสู่ระบบด้วย Google Login (FR-AUTH-02..03 - เฉพาะ ADMIN)
 */
function saveUserAllowlist(targetUser, userEmail) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const admin = requireAuthorizedUser(userEmail, 'ADMIN');
    const ss = getSpreadsheet();
    const now = new Date().toISOString();
    const userId = targetUser.user_id || ('USR-' + new Date().getTime().toString().slice(-4));

    const record = {
      user_id: userId,
      email: String(targetUser.email || '').trim().toLowerCase(),
      full_name: String(targetUser.full_name || '').trim(),
      role: String(targetUser.role || 'STAFF').toUpperCase(),
      department: String(targetUser.department || 'งานบริหารทรัพย์สินและสิทธิประโยชน์').trim(),
      status: String(targetUser.status || 'ACTIVE').toUpperCase(),
      avatar_color: targetUser.avatar_color || '#0f766e',
      updated_at: now
    };

    if (!record.email || !record.full_name) {
      throw new Error('กรุณาระบุอีเมล Google และชื่อ-นามสกุลผู้ใช้งาน');
    }

    upsertRowByKey(ss, SHEET_NAMES.USERS, 'user_id', userId, record);
    writeAuditLog(ss, admin.email, 'SAVE_USER', 'USERS', userId, 'ตั้งค่าสิทธิ์ผู้ใช้ Google Login: ' + record.email + ' (' + record.role + ')');
    return record;
  } finally {
    lock.releaseLock();
  }
}

/**
 * 8. บันทึกการตั้งค่าระบบ เช่น เรทค่าน้ำ ค่าไฟ วันแจ้งเตือน (เฉพาะ ADMIN)
 */
function saveSystemSettings(newSettings, userEmail) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const admin = requireAuthorizedUser(userEmail, 'ADMIN');
    const ss = getSpreadsheet();
    const now = new Date().toISOString();
    const existing = getSheetDataAsObjects(ss, SHEET_NAMES.SETTINGS);

    Object.keys(newSettings).forEach(key => {
      const found = existing.find(r => r.setting_key === key);
      const record = {
        setting_key: key,
        setting_value: String(newSettings[key]),
        description: found ? found.description : key,
        updated_at: now
      };
      upsertRowByKey(ss, SHEET_NAMES.SETTINGS, 'setting_key', key, record);
    });

    writeAuditLog(ss, admin.email, 'SAVE_SETTINGS', 'SETTINGS', 'ALL', 'อัปเดตค่าพารามิเตอร์ระบบ (ค่าน้ำ/ค่าไฟ/วันแจ้งเตือน)');
    return newSettings;
  } finally {
    lock.releaseLock();
  }
}

/**
 * 9. ตรวจสอบสัญญาเช่าใกล้หมดอายุ (<= 30 วัน) หรือหมดอายุแล้ว และส่งอีเมลแจ้งเตือน (FR-CONT-05)
 */
function sendContractExpiryAlerts(userEmail) {
  const ss = getSpreadsheet();
  const actor = userEmail ? requireAuthorizedUser(userEmail) : { email: 'system-trigger@skru.ac.th' };
  const contracts = getSheetDataAsObjects(ss, SHEET_NAMES.CONTRACTS);
  const shops = getSheetDataAsObjects(ss, SHEET_NAMES.SHOPS);
  const spaces = getSheetDataAsObjects(ss, SHEET_NAMES.SPACES);
  const users = getSheetDataAsObjects(ss, SHEET_NAMES.USERS);

  const today = new Date();
  const alertList = [];

  contracts.forEach(c => {
    if (c.status !== 'ACTIVE') return;
    const endDate = new Date(c.end_date);
    const diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays <= 30) {
      const shop = shops.find(s => s.shop_id === c.shop_id) || {};
      const space = spaces.find(sp => sp.space_id === c.space_id) || {};
      alertList.push({
        contract_no: c.contract_no,
        shop_name: shop.shop_name || c.shop_id,
        space_code: space.space_code || c.space_id,
        end_date: c.end_date,
        days_remaining: diffDays
      });
    }
  });

  const activeStaffEmails = users
    .filter(u => u.status === 'ACTIVE' && u.email.includes('@'))
    .map(u => u.email);

  let mailSent = false;
  if (alertList.length > 0 && activeStaffEmails.length > 0) {
    try {
      const subject = '[แจ้งเตือน มรภ.สงขลา] พบสัญญาเช่าร้านค้าใกล้หมดอายุ/หมดอายุ จำนวน ' + alertList.length + ' รายการ';
      const lines = alertList.map(
        a => '- สัญญา ' + a.contract_no + ' | ร้าน: ' + a.shop_name + ' (ล็อก ' + a.space_code + ') | สิ้นสุด: ' + a.end_date + ' (' + (a.days_remaining < 0 ? 'เกินกำหนด ' + Math.abs(a.days_remaining) + ' วัน' : 'เหลือ ' + a.days_remaining + ' วัน') + ')'
      );
      const body = 'เรียน เจ้าหน้าที่งานบริหารทรัพย์สินและสิทธิประโยชน์ มรภ.สงขลา\n\nระบบตรวจพบสัญญาเช่าร้านค้าที่ต้องดำเนินการดังนี้:\n\n' + lines.join('\n') + '\n\nตรวจสอบรายละเอียดได้ที่ระบบบริหารจัดการร้านค้า มรภ.สงขลา';
      MailApp.sendEmail(activeStaffEmails.join(','), subject, body);
      mailSent = true;
    } catch (e) {
      mailSent = false;
    }
  }

  writeAuditLog(
    ss,
    actor.email,
    'EXPIRY_ALERT_CHECK',
    'CONTRACTS',
    'COUNT:' + alertList.length,
    'ตรวจสอบสัญญาใกล้หมดอายุ พบ ' + alertList.length + ' รายการ (ส่งอีเมล: ' + (mailSent ? 'สำเร็จ' : 'จำลองการส่งในระบบ') + ')'
  );

  return {
    alertCount: alertList.length,
    alerts: alertList,
    mailSent: mailSent,
    recipients: activeStaffEmails
  };
}

/**
 * 10. สร้างไฟล์สัญญาเช่ามาตรฐาน มรภ.สงขลา อัตโนมัติ (HTML/PDF) และจัดเก็บใน Google Drive
 */
function generateContractDocument(contractId, userEmail) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const user = requireAuthorizedUser(userEmail);
    const ss = getSpreadsheet();
    const now = new Date().toISOString();

    const contracts = getSheetDataAsObjects(ss, SHEET_NAMES.CONTRACTS);
    const shops = getSheetDataAsObjects(ss, SHEET_NAMES.SHOPS);
    const spaces = getSheetDataAsObjects(ss, SHEET_NAMES.SPACES);
    const zones = getSheetDataAsObjects(ss, SHEET_NAMES.ZONES);
    const settings = getSheetDataAsObjects(ss, SHEET_NAMES.SETTINGS);

    const contract = contracts.find(c => c.contract_id === contractId);
    if (!contract) {
      throw new Error('ไม่พบสัญญาเช่าที่ระบุ (' + contractId + ')');
    }

    const shop = shops.find(s => s.shop_id === contract.shop_id) || {};
    const space = spaces.find(sp => sp.space_id === contract.space_id) || {};
    const zone = zones.find(z => z.zone_id === space.zone_id) || {};

    const waterRate = (settings.find(s => s.setting_key === 'WATER_RATE') || {}).setting_value || '15';
    const electricRate = (settings.find(s => s.setting_key === 'ELECTRIC_RATE') || {}).setting_value || '5';
    const garbageFee = (settings.find(s => s.setting_key === 'GARBAGE_FEE_DEFAULT') || {}).setting_value || '150';

    const htmlContent = buildContractHtml({
      contract: contract,
      shop: shop,
      space: space,
      zone: zone,
      waterRate: waterRate,
      electricRate: electricRate,
      garbageFee: garbageFee
    });

    let fileUrl = '';
    try {
      const fileName = 'สัญญาเช่า_' + String(contract.contract_no).replace(/[\/\\]/g, '-') + '_' + (shop.shop_name || 'ร้านค้า') + '.html';
      const blob = Utilities.newBlob(htmlContent, 'text/html', fileName);
      const file = DriveApp.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = file.getUrl();
    } catch (e) {
      fileUrl = 'https://seree999-dot.github.io/skrustore/#contract=' + encodeURIComponent(contract.contract_id);
    }

    contract.contract_file_url = fileUrl;
    contract.updated_at = now;
    contract.updated_by = user.email;
    upsertRowByKey(ss, SHEET_NAMES.CONTRACTS, 'contract_id', contract.contract_id, contract);

    writeAuditLog(ss, user.email, 'GENERATE_CONTRACT_DOC', 'CONTRACTS', contract.contract_id, 'สร้างไฟล์สัญญาเช่าอัตโนมัติเลขที่: ' + contract.contract_no);

    return {
      success: true,
      contract_id: contract.contract_id,
      contract_no: contract.contract_no,
      file_url: fileUrl,
      html_content: htmlContent
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * แม่แบบสัญญาเช่าพื้นที่ มหาวิทยาลัยราชภัฏสงขลา (HTML Template สำหรับพิมพ์และเปิดดู)
 */
function buildContractHtml(data) {
  const c = data.contract;
  const s = data.shop;
  const sp = data.space;
  const z = data.zone;

  const rentThai = Number(c.monthly_rent || 0).toLocaleString();
  const depositThai = Number(c.deposit_amount || 0).toLocaleString();

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>สัญญาเช่าพื้นที่ มรภ.สงขลา เลขที่ ${c.contract_no}</title>
  <style>
    body { font-family: 'Sarabun', 'TH Sarabun New', sans-serif; font-size: 14pt; line-height: 1.6; color: #1e293b; padding: 40px; max-width: 850px; margin: auto; }
    h1, h2, h3 { text-align: center; margin-bottom: 5px; font-weight: bold; }
    .header-box { text-align: center; border-bottom: 2px solid #881337; padding-bottom: 15px; margin-bottom: 25px; }
    .logo-badge { display: inline-block; padding: 6px 14px; background: #881337; color: white; font-weight: bold; border-radius: 6px; font-size: 14pt; margin-bottom: 10px; }
    .meta-box { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13pt; }
    .section-p { text-indent: 40px; text-align: justify; margin-bottom: 12px; }
    .bold { font-weight: bold; }
    ol { margin-left: 20px; padding-left: 20px; text-align: justify; }
    li { margin-bottom: 10px; }
    .sign-table { width: 100%; margin-top: 40px; border-collapse: collapse; }
    .sign-table td { width: 50%; text-align: center; padding: 25px 15px; vertical-align: top; }
    .sign-line { border-bottom: 1px dotted #475569; width: 220px; margin: 30px auto 8px auto; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div class="logo-badge">มหาวิทยาลัยราชภัฏสงขลา (SKRU)</div>
    <h2>สัญญาเช่าพื้นที่เพื่อการจำหน่ายสินค้าและบริการ</h2>
    <p style="margin: 0; font-size: 12pt; color: #64748b;">งานบริหารทรัพย์สินและสิทธิประโยชน์ กองกลาง สำนักงานอธิการบดี</p>
  </div>

  <div class="meta-box">
    <div><strong>สัญญาเลขที่:</strong> ${c.contract_no}</div>
    <div><strong>ทำขึ้น ณ:</strong> มหาวิทยาลัยราชภัฏสงขลา</div>
  </div>

  <p class="section-p">
    สัญญาฉบับนี้ทำขึ้นเมื่อวันที่ <span class="bold">${c.start_date}</span> ระหว่าง 
    <span class="bold">มหาวิทยาลัยราชภัฏสงขลา</span> โดย งานบริหารทรัพย์สินและสิทธิประโยชน์ กองกลาง ซึ่งต่อไปในสัญญานี้เรียกว่า 
    <span class="bold">"ผู้ให้เช่า"</span> ฝ่ายหนึ่ง กับ 
    <span class="bold">${s.owner_name || '................................'}</span> 
    เลขประจำตัวประชาชน <span class="bold">${s.citizen_id || '................................'}</span> 
    ผู้ประกอบการร้านค้า <span class="bold">"${s.shop_name || '................................'}"</span> 
    โทรศัพท์ <span class="bold">${s.phone || '................................'}</span> 
    ซึ่งต่อไปในสัญญานี้เรียกว่า <span class="bold">"ผู้เช่า"</span> อีกฝ่ายหนึ่ง
  </p>

  <p class="section-p">คู่สัญญาทั้งสองฝ่ายได้ตกลงทำสัญญาเช่าพื้นที่ โดยมีข้อความและเงื่อนไขดังต่อไปนี้:</p>

  <ol>
    <li><strong>วัตถุประสงค์และสถานที่เช่า:</strong> ผู้ให้เช่าตกลงให้เช่า และผู้เช่าตกลงเช่าพื้นที่ล็อก <strong>${sp.space_code || '-'} (${sp.space_name || '-'})</strong> ตั้งอยู่ ณ <strong>${z.zone_name || '-'}</strong> มีขนาดพื้นที่ประมาณ <strong>${sp.size_sqm || 12} ตารางเมตร</strong> เพื่อใช้ประโยชน์ในการประกอบกิจการ <strong>${s.category || 'จำหน่ายอาหารและเครื่องดื่ม'}</strong> เท่านั้น</li>
    <li><strong>กำหนดระยะเวลาการเช่า:</strong> มีกำหนดระยะเวลาตั้งแต่วันที่ <strong>${c.start_date}</strong> ถึงวันที่ <strong>${c.end_date}</strong></li>
    <li><strong>อัตราค่าเช่าและการชำระเงิน:</strong> ผู้เช่าตกลงชำระค่าเช่าพื้นที่ให้แก่ผู้ให้เช่าในอัตราเดือนละ <strong>${rentThai} บาท (${c.monthly_rent} บาทถ้วน)</strong> โดยต้องนำเงินมาชำระ ณ งานการเงินและบัญชี หรือช่องทางที่มหาวิทยาลัยกำหนด ภายในวันที่ 5 ของทุกเดือน</li>
    <li><strong>เงินประกันการปฏิบัติตามสัญญา:</strong> ในวันทำสัญญานี้ ผู้เช่าได้วางเงินประกันสัญญาเป็นจำนวนเงิน <strong>${depositThai} บาท</strong> ไว้แก่ผู้ให้เช่า เพื่อเป็นหลักประกันความเสียหาย</li>
    <li><strong>ค่าน้ำประปา ค่าไฟฟ้า และส่วนกลาง:</strong> ผู้เช่าตกลงชำระค่าน้ำประปาในอัตราหน่วยละ <strong>${data.waterRate} บาท</strong> และค่าไฟฟ้าในอัตราหน่วยละ <strong>${data.electricRate} บาท</strong> ตามจำนวนหน่วยที่ใช้จริงจากมิเตอร์ประจำล็อก และค่าจัดการขยะ/ส่วนกลางเดือนละ <strong>${data.garbageFee} บาท</strong></li>
    <li><strong>การรักษาความสะอาดและสุขอนามัย:</strong> ผู้เช่าต้องรักษาความสะอาด ถูกสุขลักษณะตามเกณฑ์มาตรฐานสุขาภิบาลอาหารของมหาวิทยาลัยราชภัฏสงขลา และปฏิบัติตามประกาศกระทรวงสาธารณสุขอย่างเคร่งครัด</li>
    <li><strong>การห้ามโอนสิทธิ์หรือเช่าช่วง:</strong> ผู้เช่าสัญญาว่าจะไม่นำพื้นที่เช่าทั้งหมดหรือบางส่วนไปให้ผู้อื่นเช่าช่วง หรือโอนสิทธิ์การเช่าให้แก่บุคคลภายนอกโดยเด็ดขาด</li>
    <li><strong>การส่งมอบพื้นที่คืนและการบอกเลิกสัญญา:</strong> หากผู้เช่าผิดนัดไม่ชำระค่าเช่าติดต่อกัน หรือกระทำผิดเงื่อนไขข้อหนึ่งข้อใด ผู้ให้เช่ามีสิทธิบอกเลิกสัญญา ยึดเงินประกัน และสั่งปิดพื้นที่เช่าได้ทันที</li>
  </ol>

  <p class="section-p" style="margin-top: 25px;">
    สัญญานี้ทำขึ้นเป็นสองฉบับมีข้อความถูกต้องตรงกัน คู่สัญญาได้อ่านและเข้าใจข้อความโดยละเอียดแล้ว จึงได้ลงลายมือชื่อไว้เป็นหลักฐานต่อหน้าพยาน
  </p>

  <table class="sign-table">
    <tr>
      <td>
        ลงชื่อ ........................................................... ผู้ให้เช่า<br>
        ( ........................................................... )<br>
        ผู้แทนมหาวิทยาลัยราชภัฏสงขลา
      </td>
      <td>
        ลงชื่อ ........................................................... ผู้เช่า<br>
        ( ${s.owner_name || '...........................................................'} )<br>
        ผู้ประกอบการร้านค้า ${s.shop_name}
      </td>
    </tr>
    <tr>
      <td>
        ลงชื่อ ........................................................... พยาน<br>
        ( ........................................................... )<br>
        หัวหน้างานบริหารทรัพย์สินและสิทธิประโยชน์
      </td>
      <td>
        ลงชื่อ ........................................................... พยาน<br>
        ( ........................................................... )<br>
        เจ้าหน้าที่งานบริหารทรัพย์สิน กองกลาง
      </td>
    </tr>
  </table>
</body>
</html>`;
}
