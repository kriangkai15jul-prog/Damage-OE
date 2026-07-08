/* ============================================================
   Damage Report — admin.js
   หน้านี้ใช้จัดการรายการตัวเลือกในฟอร์มหลัก (แผนก/ประเภทอุปกรณ์/สาเหตุ/รายการของเสียหาย)
   ต้องใส่รหัสผ่านให้ถูกต้องก่อนถึงจะแก้ไขและบันทึกได้
   ============================================================ */

// ⚠️ ต้องเป็น URL เดียวกับที่ตั้งค่าไว้ในไฟล์ script.js
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxYQm8f7RYth8mmVDSzaJJ-jTaRiyfcJqKuFMlDMLiYN25LkGSDF__2e9FnHI9elM9MOA/exec";

const gateCard      = document.getElementById("gateCard");
const editorForm    = document.getElementById("editorForm");
const passwordInput = document.getElementById("adminPassword");
const loginBtn      = document.getElementById("loginBtn");
const reloadBtn     = document.getElementById("reloadBtn");
const saveBtn       = document.getElementById("saveBtn");
const toastEl       = document.getElementById("toast");
const yearEl        = document.getElementById("year");

const listDepartments = document.getElementById("listDepartments");
const listLocations   = document.getElementById("listLocations");
const listEquipment   = document.getElementById("listEquipment");
const listCauses      = document.getElementById("listCauses");
const listItems        = document.getElementById("listItems");

let adminPassword = ""; // เก็บไว้ในหน่วยความจำระหว่างใช้งานหน้านี้เท่านั้น (ไม่บันทึกที่ไหน)

yearEl.textContent = new Date().getFullYear() + 543;

// ---------- Toast ----------
let toastTimer = null;
function showToast(message){
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 3500);
}

function setLoading(btn, isLoading){
  btn.classList.toggle("is-loading", isLoading);
  btn.disabled = isLoading;
}

function toLines(text){
  return text.split("\n").map(s => s.trim()).filter(Boolean);
}

// ---------- เข้าสู่ระบบ ----------
loginBtn.addEventListener("click", async () => {
  const pwd = passwordInput.value;
  if(!pwd){
    showToast("กรุณากรอกรหัสผ่าน");
    return;
  }

  setLoading(loginBtn, true);
  try{
    // ทดสอบรหัสผ่านด้วยการลองบันทึกข้อมูล Config ชุดปัจจุบัน (ไม่เปลี่ยนแปลงอะไรถ้ารหัสถูก)
    const config = await fetchConfig();
    const result = await saveConfigToServer(pwd, config);

    if(result.status === "error"){
      showToast(result.message || "รหัสผ่านไม่ถูกต้อง");
      return;
    }

    adminPassword = pwd;
    fillEditor(config);
    gateCard.classList.add("hidden");
    editorForm.classList.remove("hidden");
  }catch(err){
    console.error(err);
    showToast("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }finally{
    setLoading(loginBtn, false);
  }
});

passwordInput.addEventListener("keydown", (e) => {
  if(e.key === "Enter") loginBtn.click();
});

// ---------- โหลดข้อมูลปัจจุบันจาก Google Sheet ----------
async function fetchConfig(){
  const res = await fetch(`${APPS_SCRIPT_URL}?action=getConfig&_=${Date.now()}`, { cache: "no-store" });
  const data = await res.json();
  return {
    departments: data.departments || [],
    equipmentTypes: data.equipmentTypes || [],
    causes: data.causes || [],
    itemSuggestions: data.itemSuggestions || [],
    locations: data.locations || []
  };
}

function fillEditor(config){
  listDepartments.value = config.departments.join("\n");
  listLocations.value = config.locations.join("\n");
  listEquipment.value = config.equipmentTypes.join("\n");
  listCauses.value = config.causes.join("\n");
  listItems.value = config.itemSuggestions.join("\n");
}

reloadBtn.addEventListener("click", async () => {
  setLoading(reloadBtn, true);
  try{
    const config = await fetchConfig();
    fillEditor(config);
    showToast("โหลดข้อมูลล่าสุดแล้ว");
  }catch(err){
    console.error(err);
    showToast("โหลดข้อมูลไม่สำเร็จ");
  }finally{
    setLoading(reloadBtn, false);
  }
});

// ---------- บันทึกการเปลี่ยนแปลง ----------
editorForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const config = {
    departments: toLines(listDepartments.value),
    equipmentTypes: toLines(listEquipment.value),
    causes: toLines(listCauses.value),
    itemSuggestions: toLines(listItems.value),
    locations: toLines(listLocations.value)
  };

  setLoading(saveBtn, true);
  try{
    const result = await saveConfigToServer(adminPassword, config);
    if(result.status === "error"){
      showToast(result.message || "บันทึกไม่สำเร็จ");
      return;
    }
    showToast("บันทึกการเปลี่ยนแปลงสำเร็จ");
  }catch(err){
    console.error(err);
    showToast("บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }finally{
    setLoading(saveBtn, false);
  }
});

async function saveConfigToServer(password, config){
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "saveConfig", password, ...config })
  });
  return res.json();
}
