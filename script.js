/* ============================================================
   Damage Report — script.js
   ============================================================ */

// ⚠️ แก้ไข URL นี้เป็น URL ของ Google Apps Script Web App ของคุณ
// (ดูวิธีตั้งค่าใน Code.gs ที่แนบมาให้)
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxYQm8f7RYth8mmVDSzaJJ-jTaRiyfcJqKuFMlDMLiYN25LkGSDF__2e9FnHI9elM9MOA/exec";

const MAX_IMAGE_DIMENSION = 1280;   // ย่อรูปก่อนส่งเพื่อลดขนาดไฟล์
const MAX_PHOTOS = 6;

// ---------- Elements ----------
const form            = document.getElementById("damageForm");
const reportDateEl    = document.getElementById("reportDate");
const departmentEl    = document.getElementById("department");
const departmentOther = document.getElementById("departmentOther");
const equipTypeEl     = document.getElementById("equipType");
const equipTypeOther  = document.getElementById("equipTypeOther");
const causeEl         = document.getElementById("cause");
const causeOther      = document.getElementById("causeOther");
const quantityEl      = document.getElementById("quantity");
const qtyMinus        = document.getElementById("qtyMinus");
const qtyPlus         = document.getElementById("qtyPlus");
const photosInput     = document.getElementById("photos");
const previewGrid     = document.getElementById("previewGrid");
const clearBtn        = document.getElementById("clearBtn");
const submitBtn       = document.getElementById("submitBtn");
const successOverlay  = document.getElementById("successOverlay");
const overlayCloseBtn = document.getElementById("overlayCloseBtn");
const toastEl         = document.getElementById("toast");
const yearEl          = document.getElementById("year");

let photoFiles = []; // { file, dataUrl }

// ค่าเริ่มต้น ใช้กรณีดึงข้อมูลจาก Google Sheet ไม่สำเร็จ (เช่น ยังไม่ได้ตั้งค่า/ออฟไลน์)
const DEFAULT_CONFIG = {
  departments: ["Front Office","Housekeeping","Kitchen","Restaurant","Bar","Engineering","Accounting","Sales","HR","Security","Spa","Laundry"],
  equipmentTypes: ["แก้ว","จาน","ชาม","ถ้วยกาแฟ","แก้วไวน์","แก้วเบียร์","ช้อน","ส้อม","มีด","อุปกรณ์ครัว","เครื่องใช้ไฟฟ้า"],
  causes: ["แตก","ร้าว","บิ่น","สูญหาย","ชำรุด"],
  itemSuggestions: ["แก้วน้ำ Hi-ball","แก้วไวน์แดง","แก้วไวน์ขาว","จานหลัก 10 นิ้ว","จานรอง","ชามซุป","ถ้วยกาแฟ + จานรอง","ช้อนโต๊ะ","ส้อมโต๊ะ","มีดสเต็ก","กระทะ","หม้อ"]
};

// ---------- Init ----------
yearEl.textContent = new Date().getFullYear() + 543; // พ.ศ.
setTodayDate();
loadFormConfig();

// ดึงรายการแผนก/ประเภทอุปกรณ์/สาเหตุ/รายการของเสียหาย จาก Google Sheet (ชีต Config)
// เพื่อให้ Admin แก้ไขรายการเหล่านี้ผ่านหน้า admin.html ได้ โดยไม่ต้องแก้โค้ด
async function loadFormConfig(){
  // แสดงรายการเริ่มต้นทันที โดยไม่ต้องรอเน็ต เพื่อไม่ให้ dropdown ว่างระหว่างโหลด
  applyConfig(DEFAULT_CONFIG);

  try{
    if(!APPS_SCRIPT_URL.includes("YOUR_DEPLOYMENT_ID")){
      const res = await fetch(`${APPS_SCRIPT_URL}?action=getConfig`);
      const data = await res.json();
      if(data && data.status !== "error"){
        const config = {
          departments: data.departments?.length ? data.departments : DEFAULT_CONFIG.departments,
          equipmentTypes: data.equipmentTypes?.length ? data.equipmentTypes : DEFAULT_CONFIG.equipmentTypes,
          causes: data.causes?.length ? data.causes : DEFAULT_CONFIG.causes,
          itemSuggestions: data.itemSuggestions?.length ? data.itemSuggestions : DEFAULT_CONFIG.itemSuggestions
        };
        // อัปเดตเป็นรายการล่าสุดจาก Google Sheet (ถ้าต่างจากค่าเริ่มต้น)
        applyConfig(config);
      }
    }
  }catch(err){
    console.warn("โหลดรายการจาก Google Sheet ไม่สำเร็จ ใช้ค่าเริ่มต้นแทน", err);
  }
}

function applyConfig(config){
  populateSelect(departmentEl, config.departments);
  populateSelect(equipTypeEl, config.equipmentTypes);
  populateSelect(causeEl, config.causes);
  populateDatalist(document.getElementById("itemSuggestions"), config.itemSuggestions);
}

// เติม <option> เข้าไปก่อนตัวเลือก "อื่นๆ" ที่อยู่ท้ายสุดของ select เดิม
// ลบตัวเลือกที่เพิ่มไว้ก่อนหน้า (ถ้ามี) ออกก่อนเสมอ กันไม่ให้รายการซ้ำตอนอัปเดตรอบสอง
function populateSelect(selectEl, items){
  Array.from(selectEl.options).forEach(o => {
    if(o.value !== "" && o.value !== "อื่นๆ") o.remove();
  });
  const otherOption = Array.from(selectEl.options).find(o => o.value === "อื่นๆ");
  items.forEach(text => {
    const opt = document.createElement("option");
    opt.value = text;
    opt.textContent = text;
    selectEl.insertBefore(opt, otherOption);
  });
}

function populateDatalist(datalistEl, items){
  datalistEl.innerHTML = "";
  items.forEach(text => {
    const opt = document.createElement("option");
    opt.value = text;
    datalistEl.appendChild(opt);
  });
}

function setTodayDate(){
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  reportDateEl.value = `${yyyy}-${mm}-${dd}`; // ค่าเริ่มต้นของ <input type="date">
  reportDateEl.max = `${yyyy}-${mm}-${dd}`;   // ป้องกันเลือกวันที่ในอนาคต (ลบบรรทัดนี้ได้ถ้าไม่ต้องการ)
}

// แปลง yyyy-mm-dd เป็นวันที่แบบไทย เช่น "วันจันทร์ที่ 7 กรกฎาคม 2569" สำหรับใช้ตอนบันทึกข้อมูล
function formatThaiDate(isoDate){
  if(!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const days = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
  const months = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  return `วัน${days[dateObj.getDay()]}ที่ ${d} ${months[m - 1]} ${y + 543}`;
}

// ---------- "อื่นๆ" toggles ----------
function bindOtherToggle(select, otherInput){
  select.addEventListener("change", () => {
    const isOther = select.value === "อื่นๆ";
    otherInput.classList.toggle("hidden", !isOther);
    otherInput.required = isOther;
    if(isOther) otherInput.focus();
    else otherInput.value = "";
  });
}
bindOtherToggle(departmentEl, departmentOther);
bindOtherToggle(equipTypeEl, equipTypeOther);
bindOtherToggle(causeEl, causeOther);

// ---------- Quantity stepper ----------
qtyMinus.addEventListener("click", () => {
  const v = Math.max(1, (parseInt(quantityEl.value, 10) || 1) - 1);
  quantityEl.value = v;
});
qtyPlus.addEventListener("click", () => {
  const v = (parseInt(quantityEl.value, 10) || 1) + 1;
  quantityEl.value = v;
});

// ---------- Photo handling ----------
photosInput.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  for(const file of files){
    if(photoFiles.length >= MAX_PHOTOS){
      showToast(`แนบรูปได้สูงสุด ${MAX_PHOTOS} รูป`);
      break;
    }
    if(!file.type.startsWith("image/")) continue;
    try{
      const dataUrl = await resizeImage(file, MAX_IMAGE_DIMENSION);
      const id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      photoFiles.push({ id, file, dataUrl });
      renderPreview({ id, dataUrl });
    }catch(err){
      console.error(err);
      showToast("ไม่สามารถโหลดรูปภาพนี้ได้");
    }
  }
  photosInput.value = ""; // allow re-selecting same file
});

function renderPreview({ id, dataUrl }){
  const item = document.createElement("div");
  item.className = "preview-item";
  item.dataset.id = id;
  item.innerHTML = `
    <img src="${dataUrl}" alt="ตัวอย่างรูปของเสียหาย">
    <button type="button" class="preview-item__remove" aria-label="ลบรูปนี้">✕</button>
  `;
  item.querySelector(".preview-item__remove").addEventListener("click", () => {
    photoFiles = photoFiles.filter(p => p.id !== id);
    item.remove();
  });
  previewGrid.appendChild(item);
}

function resizeImage(file, maxDim){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image decode failed"));
      img.onload = () => {
        let { width, height } = img;
        if(width > maxDim || height > maxDim){
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ---------- Toast ----------
let toastTimer = null;
function showToast(message){
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 3200);
}

// ---------- Clear form ----------
clearBtn.addEventListener("click", () => resetForm());

function resetForm(){
  form.reset();
  setTodayDate();
  quantityEl.value = 1;
  departmentOther.classList.add("hidden");
  equipTypeOther.classList.add("hidden");
  causeOther.classList.add("hidden");
  departmentOther.required = false;
  equipTypeOther.required = false;
  causeOther.required = false;
  photoFiles = [];
  previewGrid.innerHTML = "";
}

// ---------- Submit ----------
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if(!form.checkValidity()){
    form.reportValidity();
    return;
  }

  const payload = {
    action: "submitReport",
    date: formatThaiDate(reportDateEl.value),
    timestamp: new Date().toISOString(),
    department: departmentEl.value === "อื่นๆ" ? departmentOther.value.trim() : departmentEl.value,
    location: document.getElementById("location").value.trim(),
    equipType: equipTypeEl.value === "อื่นๆ" ? equipTypeOther.value.trim() : equipTypeEl.value,
    itemName: document.getElementById("itemName").value.trim(),
    quantity: quantityEl.value,
    cause: causeEl.value === "อื่นๆ" ? causeOther.value.trim() : causeEl.value,
    details: document.getElementById("details").value.trim(),
    reporterName: document.getElementById("reporterName").value.trim(),
    photos: photoFiles.map(p => ({ name: p.file.name, dataUrl: p.dataUrl }))
  };

  setLoading(true);
  try{
    if(APPS_SCRIPT_URL.includes("YOUR_DEPLOYMENT_ID")){
      throw new Error("CONFIG_MISSING");
    }

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      // ใช้ text/plain เพื่อหลีกเลี่ยง CORS preflight กับ Google Apps Script
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const result = await res.json().catch(() => ({ status: "ok" }));
    if(result.status && result.status !== "ok"){
      throw new Error(result.message || "SERVER_ERROR");
    }

    showSuccess();
    resetForm();
  }catch(err){
    console.error(err);
    if(err.message === "CONFIG_MISSING"){
      showToast("ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL ใน script.js");
    }else{
      showToast("ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  }finally{
    setLoading(false);
  }
});

function setLoading(isLoading){
  submitBtn.classList.toggle("is-loading", isLoading);
  submitBtn.disabled = isLoading;
}

function showSuccess(){
  successOverlay.classList.remove("hidden");
}
overlayCloseBtn.addEventListener("click", () => {
  successOverlay.classList.add("hidden");
});
