
const SHEET_URL = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortบัญชีเงินมากและฝากมากกว่าหรือเท่ากับค่าเฉลี่ย';
const LIFF_ID   = '2005230346-2OVa774O';

let tableHeaders = [];
let lastData = [];
let liffReady = false;
let liffInitOnce = null;

// Utilities
const isNumeric = (val) => {
  if (val === null || val === undefined) return false;
  const n = Number(String(val).replace(/[, ]/g,''));
  return Number.isFinite(n);
};
const fmtNumber = (val) => {
  const n = Number(String(val).replace(/[, ]/g,''));
  return Number.isFinite(n) ? n.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : String(val ?? '');
};
const cut = (s, len) => String(s ?? '').length > len ? String(s).slice(0, len - 1) + '…' : String(s ?? '');

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(()=>t.classList.add('hidden'), 2200);
}

function showLoginBadge(show){
  const badge = document.getElementById('loginBadge');
  if (show) badge.classList.add('show'); else badge.classList.remove('show');
}

// Heuristic: header names considered as account number → do NOT add commas
function isAccountHeader(h){
  return /(เลข\s*บัญชี|บัญชี|account)/i.test(String(h));
}

// Render Table (center columns + no comma for account numbers)
function renderTable(data){
  const thead = document.getElementById('table-head');
  const tbody = document.getElementById('table-body');
  thead.innerHTML=''; tbody.innerHTML='';

  if (!Array.isArray(data) || data.length === 0){
    thead.innerHTML = '<th>ข้อมูล</th>';
    tbody.innerHTML = '<tr><td>ไม่พบข้อมูล</td></tr>';
    tableHeaders = [];
    return;
  }
  tableHeaders = Object.keys(data[0] || {});
  tableHeaders.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    thead.appendChild(th);
  });
  data.forEach(row => {
    const tr = document.createElement('tr');
    tableHeaders.forEach(h => {
      const td = document.createElement('td');
      const raw = row[h];
      // ถ้าเป็นเลขบัญชี → แสดงตรง ๆ (ไม่เติม comma)
      if (isAccountHeader(h)) {
        td.textContent = String(raw ?? '');
      } else {
        td.textContent = isNumeric(raw) ? fmtNumber(raw) : String(raw ?? '');
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

// Load data
async function loadData(){
  document.getElementById('today').textContent = new Date().toLocaleDateString('th-TH');
  try{
    const res = await fetch(SHEET_URL, { cache: 'no-store' });
    const data = await res.json();
    lastData = Array.isArray(data) ? data : [];
    renderTable(lastData);
  }catch(e){
    console.error(e);
    renderTable([]);
    toast('โหลดข้อมูลไม่สำเร็จ');
  }
}

// LIFF
async function ensureLiffReady(){
  if (liffReady) return true;
  if (!liffInitOnce){
    liffInitOnce = liff.init({ liffId: LIFF_ID })
      .then(()=>{ liffReady = true; return true; })
      .catch(e => { console.warn('LIFF init failed:', e); return false; });
  }
  return liffInitOnce;
}

async function loadProfile(){
  const avatar = document.getElementById('avatar');
  const pfAvatar = document.getElementById('pfAvatar');
  const pfName = document.getElementById('pfName');
  const pfSub = document.getElementById('pfSub');

  const ok = await ensureLiffReady();
  if (!ok){
    showLoginBadge(true);
    return;
  }

  try{
    if (!liff.isLoggedIn()) {
      showLoginBadge(true);
      pfName.textContent = 'Guest';
      pfSub.textContent = 'ยังไม่ได้เข้าสู่ระบบ LINE';
      return;
    }
    showLoginBadge(false);

    const prof = await liff.getProfile();
    if (prof?.pictureUrl){
      avatar.src = prof.pictureUrl;
      pfAvatar.src = prof.pictureUrl;
    }
    if (prof?.displayName){
      pfName.textContent = prof.displayName;
      pfSub.textContent = liff.isInClient()? 'เปิดผ่าน LINE': 'เปิดผ่านเว็บ';
    }
  }catch(e){
    showLoginBadge(true);
  }
}

function buildFlexFromData(data){
  const headers = Object.keys(data[0] || {});
  const top10 = data.slice(0,10);
  const headerBox = {
    type:'box', layout:'horizontal',
    contents: headers.map(h => ({ type:'text', text: cut(h,12), size:'xs', weight:'bold', flex:1, align:'center' }))
  };
  const dataRows = top10.map((row, idx) => ({
    type:'box', layout:'horizontal', backgroundColor: idx%2? '#FFFFFF':'#F5F6FA',
    contents: headers.map(h => ({
      type:'text',
      text: cut(isAccountHeader(h) ? String(row[h] ?? '') : (isNumeric(row[h])? fmtNumber(row[h]): (row[h] ?? '')), 16),
      size:'xs', flex:1, align:'center'
    }))
  }));
  return {
    type:'flex',
    altText:'TOP 10 ฝากเงินเก่งมาก — บ้านวังด้ง',
    contents:{
      type:'bubble', size:'giga',
      hero:{ type:'image', url:'https://raw.githubusercontent.com/infobwd/wdconnect/main/top10.png',
        size:'full', aspectRatio:'20:13', aspectMode:'cover',
        action:{ type:'uri', uri:`https://liff.line.me/${LIFF_ID}` } },
      body:{ type:'box', layout:'vertical', contents:[
        { type:'text', text:'TOP 10 ฝากเงินเก่งมาก', weight:'bold', size:'lg' },
        { type:'text', text:`โรงเรียนบ้านวังด้ง • ${new Date().toLocaleDateString('th-TH')}`, color:'#7286D3', size:'sm' },
        { type:'separator', margin:'md' },
        headerBox,
        { type:'separator', margin:'sm' },
        { type:'box', layout:'vertical', margin:'md', spacing:'sm', contents:dataRows }
      ]},
      footer:{ type:'box', layout:'vertical', spacing:'sm', contents:[
        { type:'button', style:'primary', action:{ type:'uri', label:'คลิกเพื่ออัปเดตข้อมูล', uri:`https://liff.line.me/${LIFF_ID}` } }
      ]}
    }
  };
}

// Share with login choice when outside LINE
async function shareToLine(){
  // ensure data
  if (!Array.isArray(lastData) || lastData.length===0){
    try{
      const res = await fetch(SHEET_URL, { cache:'no-store' });
      lastData = await res.json();
    }catch(e){ toast('ไม่มีข้อมูลที่จะแชร์'); return; }
  }
  if (!Array.isArray(lastData) || lastData.length===0){ toast('ไม่มีข้อมูลที่จะแชร์'); return; }

  await ensureLiffReady();
  const loggedIn = liff.isLoggedIn?.() === true;
  const inClient = liff.isInClient?.() === true;

  // แจ้งเตือนหากยังไม่ login (แสดง badge + toast)
  if (!loggedIn){
    showLoginBadge(true);
    toast('ยังไม่เข้าสู่ระบบ LINE');
  }

  // ถ้าอยู่นอก LINE และยังไม่ login → ถามตัวเลือกก่อนแชร์
  if (!inClient && !loggedIn){
    const res = await Swal.fire({
      title: 'ยังไม่ได้เข้าสู่ระบบ LINE',
      text: 'ต้องการเข้าสู่ระบบก่อน แล้วค่อยแชร์ไหม? (แนะนำเพื่อประสบการณ์เหมือนแอปธนาคาร)',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'เข้าสู่ระบบก่อน',
      cancelButtonText: 'แชร์เลย (ไม่ล็อกอิน)'
    });
    if (res.isConfirmed){
      // login แล้วกลับมาหน้าเดิม
      return liff.login({ redirectUri: location.href });
    }
    // ผู้ใช้เลือกแชร์ต่อได้ตามเดิม
  }

  const flex = buildFlexFromData(lastData);
  try{
    const result = await liff.shareTargetPicker([flex]);
    if (result) toast('แชร์ไปยัง LINE แล้ว');
    else toast('ปิดหน้าต่างแชร์โดยไม่ส่ง');
    if (liff.closeWindow) liff.closeWindow();
  }catch(e){
    console.warn('shareTargetPicker error:', e);
    toast('ไม่สามารถเปิดหน้าต่างแชร์อัตโนมัติได้');
  }
}

// Bottom Sheet
function openSheet(){ document.getElementById('profileSheet').classList.remove('hidden'); }
function closeSheet(){ document.getElementById('profileSheet').classList.add('hidden'); }

// Events
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('today').textContent = new Date().toLocaleDateString('th-TH');
  loadData();
  loadProfile();

  document.getElementById('btnShare').addEventListener('click', shareToLine);

  const btnProfile = document.getElementById('btnProfile');
  const sheetClose = document.getElementById('sheetClose');
  btnProfile.addEventListener('click', openSheet);
  sheetClose.addEventListener('click', closeSheet);
  document.getElementById('profileSheet').addEventListener('click', (e)=>{
    if (e.target.id === 'profileSheet') closeSheet();
  });

  // Actions in sheet
  document.getElementById('btnLineLogin').addEventListener('click', async ()=>{
    const ok = await ensureLiffReady();
    if (!ok){ return toast('ไม่สามารถเริ่มระบบ LINE ได้'); }
    if (!liff.isLoggedIn()){
      liff.login({ redirectUri: location.href });
    }else{
      toast('ล็อกอินแล้ว');
    }
  });
  document.getElementById('btnLineOpen').addEventListener('click', ()=>{
    if (typeof liff?.openWindow === 'function'){
      liff.openWindow({ url:`https://liff.line.me/${LIFF_ID}`, external:true });
    }else{
      toast('เปิดใน LINE ไม่ได้');
    }
  });
});
