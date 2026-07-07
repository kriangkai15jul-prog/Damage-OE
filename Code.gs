/**
 * Damage Report — Google Apps Script Backend
 * ------------------------------------------
 * บันทึกข้อมูลลง Google Sheets, รูปภาพลง Google Drive
 * และเก็บ "รายการตัวเลือกในฟอร์ม" (แผนก/ประเภทอุปกรณ์/สาเหตุ/รายการของเสียหาย)
 * ไว้ในชีต Config เพื่อให้ Admin แก้ไขได้ผ่านหน้า admin.html โดยไม่ต้องแก้โค้ด
 *
 * วิธีติดตั้ง:
 * 1) สร้าง Google Sheet ใหม่ (ไม่ต้องสร้างชีตหรือหัวตารางเอง สคริปต์จะสร้างให้อัตโนมัติ
 *    ทั้งชีต "Reports" และชีต "Config" ในการรันครั้งแรก)
 * 2) เปิด Extensions > Apps Script แล้ววางโค้ดนี้ทับไฟล์ Code.gs ทั้งหมด
 * 3) แก้ค่า ADMIN_PASSWORD ด้านล่างเป็นรหัสผ่านของคุณเอง (สำคัญมาก ห้ามใช้ค่าเริ่มต้น)
 * 4) ไปที่ Deploy > New deployment > เลือกประเภท "Web app"
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5) คัดลอก Web app URL ไปใส่ในตัวแปร APPS_SCRIPT_URL ที่ไฟล์ script.js และ admin.js
 * 6) ทุกครั้งที่แก้โค้ดนี้ ต้องกด Deploy > Manage deployments > แก้ไข (ไอคอนดินสอ) > Deploy ใหม่เสมอ
 */

const SHEET_NAME = "Reports";
const CONFIG_SHEET_NAME = "Config";
const DRIVE_FOLDER_NAME = "Damage Report - Photos";

// ⚠️ เปลี่ยนรหัสผ่านนี้เป็นของคุณเอง — ใครก็ตามที่รู้รหัสนี้จะแก้ไขรายการในฟอร์มได้
const ADMIN_PASSWORD = "changeme123";

// ค่าเริ่มต้นของรายการต่างๆ ใช้ตอนสร้างชีต Config ครั้งแรกเท่านั้น
const DEFAULT_CONFIG = {
  departments: ["Front Office","Housekeeping","Kitchen","Restaurant","Bar","Engineering","Accounting","Sales","HR","Security","Spa","Laundry"],
  equipmentTypes: ["แก้ว","จาน","ชาม","ถ้วยกาแฟ","แก้วไวน์","แก้วเบียร์","ช้อน","ส้อม","มีด","อุปกรณ์ครัว","เครื่องใช้ไฟฟ้า"],
  causes: ["แตก","ร้าว","บิ่น","สูญหาย","ชำรุด"],
  itemSuggestions: ["แก้วน้ำ Hi-ball","แก้วไวน์แดง","แก้วไวน์ขาว","จานหลัก 10 นิ้ว","จานรอง","ชามซุป","ถ้วยกาแฟ + จานรอง","ช้อนโต๊ะ","ส้อมโต๊ะ","มีดสเต็ก","กระทะ","หม้อ"]
};

// ============================================================
// doGet — ใช้สำหรับ "อ่าน" ข้อมูล (ทดสอบระบบ / ดึงรายการตัวเลือกในฟอร์ม)
// ============================================================
function doGet(e) {
  const action = e.parameter.action;

  if (action === "getConfig") {
    return jsonResponse(getConfigData());
  }

  return ContentService
    .createTextOutput("Damage Report API is running.")
    .setMimeType(ContentService.MimeType.TEXT);
}

// ============================================================
// doPost — ใช้สำหรับ "เขียน" ข้อมูล (ส่งรายงานของเสียหาย / บันทึกการแก้ไขของ Admin)
// ============================================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action === "saveConfig") {
      return saveConfigData(data);
    }

    // ค่าเริ่มต้น: ถือว่าเป็นการส่งรายงานของเสียหายจากฟอร์มหลัก
    return submitReport(data);
  } catch (err) {
    return jsonResponse({ status: "error", message: err.message });
  }
}

// ============================================================
// ส่วนของฟอร์มหลัก: บันทึกรายงานของเสียหาย
// ============================================================
function submitReport(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "วันที่", "เวลา", "แผนก", "สถานที่", "ประเภทอุปกรณ์",
      "รายการ", "จำนวน", "สาเหตุ", "รายละเอียดเพิ่มเติม",
      "ชื่อผู้แจ้ง", "ลิงก์รูปภาพ"
    ]);
  }

  const photoLinks = saveImages(data.photos || [], data);
  const now = new Date();

  sheet.appendRow([
    data.date || "",
    Utilities.formatDate(now, Session.getScriptTimeZone(), "HH:mm:ss"),
    data.department || "",
    data.location || "",
    data.equipType || "",
    data.itemName || "",
    data.quantity || "",
    data.cause || "",
    data.details || "",
    data.reporterName || "",
    photoLinks.join(", ")
  ]);

  return jsonResponse({ status: "ok" });
}

function saveImages(photos, data) {
  if (!photos.length) return [];

  const folder = getOrCreateFolder(DRIVE_FOLDER_NAME);
  const links = [];

  photos.forEach((photo, i) => {
    try {
      const match = photo.dataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
      if (!match) return;

      const mimeType = match[1];
      const base64 = match[2];
      const bytes = Utilities.base64Decode(base64);
      const safeReporter = (data.reporterName || "unknown").replace(/[^a-zA-Z0-9ก-๙]/g, "_");
      const fileName = `${data.date || ""}_${safeReporter}_${i + 1}.jpg`;

      const blob = Utilities.newBlob(bytes, mimeType, fileName);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      links.push(file.getUrl());
    } catch (err) {
      // ข้ามรูปที่มีปัญหา ไม่ให้ทั้งฟอร์มล้มเหลว
    }
  });

  return links;
}

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}

// ============================================================
// ส่วนของ Admin: อ่าน / แก้ไข รายการตัวเลือกในฟอร์ม (ชีต Config)
// ============================================================

// โครงสร้างชีต Config: แถวที่ 1 เป็นหัวตาราง 4 คอลัมน์
// A: Departments | B: EquipmentTypes | C: Causes | D: ItemSuggestions
// แต่ละคอลัมน์ใส่รายการได้ไม่จำกัดแถว (ตั้งแต่แถวที่ 2 ลงมา)
function getConfigSheet() {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET_NAME);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(CONFIG_SHEET_NAME);
    sheet.appendRow(["Departments", "EquipmentTypes", "Causes", "ItemSuggestions"]);
    writeConfigColumns(sheet, DEFAULT_CONFIG);
  }
  return sheet;
}

function getConfigData() {
  const sheet = getConfigSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return {
      status: "ok",
      departments: [], equipmentTypes: [], causes: [], itemSuggestions: []
    };
  }
  const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  return {
    status: "ok",
    departments: values.map(r => r[0]).filter(String),
    equipmentTypes: values.map(r => r[1]).filter(String),
    causes: values.map(r => r[2]).filter(String),
    itemSuggestions: values.map(r => r[3]).filter(String)
  };
}

function saveConfigData(data) {
  if (data.password !== ADMIN_PASSWORD) {
    return jsonResponse({ status: "error", message: "รหัสผ่านไม่ถูกต้อง" });
  }

  const sheet = getConfigSheet();

  // ล้างข้อมูลเก่าทั้งหมด (ยกเว้นหัวตารางแถวแรก) ก่อนเขียนใหม่
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 4).clearContent();
  }

  writeConfigColumns(sheet, {
    departments: data.departments || [],
    equipmentTypes: data.equipmentTypes || [],
    causes: data.causes || [],
    itemSuggestions: data.itemSuggestions || []
  });

  return jsonResponse({ status: "ok" });
}

function writeConfigColumns(sheet, config) {
  const columns = [
    config.departments || [],
    config.equipmentTypes || [],
    config.causes || [],
    config.itemSuggestions || []
  ];
  const maxLen = Math.max(1, ...columns.map(c => c.length));

  const rows = [];
  for (let i = 0; i < maxLen; i++) {
    rows.push([
      columns[0][i] || "",
      columns[1][i] || "",
      columns[2][i] || "",
      columns[3][i] || ""
    ]);
  }
  sheet.getRange(2, 1, rows.length, 4).setValues(rows);
}

// ============================================================
// Utility
// ============================================================
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
