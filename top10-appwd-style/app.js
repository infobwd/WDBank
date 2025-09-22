
const SHEET_URL = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortบัญชีเงินมากและฝากมากกว่าหรือเท่ากับค่าเฉลี่ย';
const LIFF_ID   = '2005230346-2OVa774O';

let tableHeaders = [];
let lastData = [];
let liffReady = false;
let liffInitOnce = null;

// === Utilities ===
const isNumeric = (val) => {
  if (val === null || val === undefined) return false;
  const n = Number(String(val).replace(/[, ]/g,''));
  return Number.isFinite(n);
};
const toNumber = (val) => Number(String(val).replace(/[, ]/g,''));
const fmtNumber = (val) => {
  const n = Number(String(val).replace(/[, ]/g,''));
  return Number.isFinite(n) ? n.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : String(val ?? '');
};
const cut = (s, len) => String(s ?? '').length > len ? String(s).slice(0, len - 1) + '…' : String(s ?? '');
const thaiDateString = (d=new Date()) => d.toLocaleDateString('th-TH', { year:'numeric', month:'long', day:'numeric' });

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

// Heuristic: headers
function isAccountHeader(h){ return /(เลข\s*บัญชี|บัญชี|account)/i.test(String(h)); }
function isCountHeader(h){ return /(จำนวน|ครั้ง|count)/i.test(String(h)); }
function isAmountHeader(h){ return /(ยอด|รวม|amount|total|เงิน)/i.test(String(h)); }

// === Rendering ===
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
  tbody.innerHTML = '';
  data.forEach(row => {
    const tr = document.createElement('tr');
    tableHeaders.forEach(h => {
      const td = document.createElement('td');
      const raw = row[h];
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

function populateHeaderSelectors(){
  const amountSel = document.getElementById('amountHeaderSelect');
  const countSel  = document.getElementById('countHeaderSelect');
  amountSel.innerHTML = ''; countSel.innerHTML = '';

  tableHeaders.forEach(h => {
    const opt1 = document.createElement('option'); opt1.value = h; opt1.textContent = h;
    const opt2 = document.createElement('option'); opt2.value = h; opt2.textContent = h;
    amountSel.appendChild(opt1); countSel.appendChild(opt2);
  });

  // Auto guess
  let guessAmount = tableHeaders.find(isAmountHeader) || tableHeaders.find(h => h !== tableHeaders[0] && h !== tableHeaders[1]);
  let guessCount  = tableHeaders.find(isCountHeader)  || tableHeaders.find(h => h !== guessAmount);

  if (guessAmount) amountSel.value = guessAmount;
  if (guessCount)  countSel.value  = guessCount;
}

function updateKPI(){
  const amountHeader = document.getElementById('amountHeaderSelect').value;
  if (!amountHeader) { document.getElementById('sumDeposit').textContent = '—'; return; }
  const sum = lastData.reduce((acc, r) => {
    const v = r[amountHeader];
    return acc + (isNumeric(v) ? toNumber(v) : 0);
  }, 0);
  document.getElementById('sumDeposit').textContent = fmtNumber(sum) + ' บาท';
}

// === Data ===
async function loadData(){
  document.getElementById('todayThai').textContent = thaiDateString();
  document.getElementById('asOfThai').textContent  = thaiDateString();
  try{
    const res = await fetch(SHEET_URL, { cache: 'no-store' });
    const data = await res.json();
    lastData = Array.isArray(data) ? data : [];
    renderTable(lastData);
    populateHeaderSelectors();
    updateKPI();
  }catch(e){
    console.error(e);
    renderTable([]);
    toast('โหลดข้อมูลไม่สำเร็จ');
  }
}

// === LIFF ===
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

// === Share ===
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
    altText:'WDBank — TOP 10 ฝากเงินเก่ง',
    contents:{
      type:'bubble', size:'giga',
      hero:{ type:'image', url:'https://raw.githubusercontent.com/infobwd/wdconnect/main/top10.png',
        size:'full', aspectRatio:'20:13', aspectMode:'cover',
        action:{ type:'uri', uri:`https://liff.line.me/${LIFF_ID}` } },
      body:{ type:'box', layout:'vertical', contents:[
        { type:'text', text:'WDBank • TOP 10 ฝากเงินเก่ง', weight:'bold', size:'lg' },
        { type:'text', text:`ออมก่อนใช้ • ${thaiDateString()}`, color:'#7286D3', size:'sm' },
        { type:'separator', margin:'md' },
        headerBox,
        { type:'separator', margin:'sm' },
        { type:'box', layout:'vertical', margin:'md', spacing:'sm', contents:dataRows }
      ]},
      footer:{ type:'box', layout:'vertical', spacing:'sm', contents:[
        { type:'button', style:'primary', action:{ type:'uri', label:'เปิดใน WDBank', uri:`https://liff.line.me/${LIFF_ID}` } }
      ]}
    }
  };
}

async function shareToLine(){
  if (!Array.isArray(lastData) || lastData.length===0){
    try{
      const res = await fetch(SHEET_URL, { cache:'no-store' });
      lastData = await res.json();
    }catch(e){ toast('ไม่มีข้อมูลที่จะแชร์'); return; }
  }
  if (!Array.isArray(lastData) || lastData.length===0){ toast('ไม่มีข้อมูลที่จะแชร์'); return; }

  await ensureLiffReady();
  const loggedIn = liff.isLoggedIn?.() === true;
  if (!loggedIn){
    await Swal.fire({
      title: 'ต้องเข้าสู่ระบบ LINE',
      text: 'เพื่อแชร์ผ่าน LINE จำเป็นต้องเข้าสู่ระบบก่อน',
      icon: 'info',
      confirmButtonText: 'เข้าสู่ระบบ'
    });
    return liff.login({ redirectUri: location.href });
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

// === Controls: Sorting & PDF ===
let sortAmountDesc = true;
let sortCountDesc  = true;

function applySort(){
  renderTable(lastData);
  updateKPI();
}

function sortByAmount(){
  const amountHeader = document.getElementById('amountHeaderSelect').value;
  if (!amountHeader) return toast('ยังไม่ได้เลือกคอลัมน์ยอดเงิน');
  lastData.sort((a,b)=>{
    const va = isNumeric(a[amountHeader]) ? toNumber(a[amountHeader]) : -Infinity;
    const vb = isNumeric(b[amountHeader]) ? toNumber(b[amountHeader]) : -Infinity;
    return sortAmountDesc ? vb - va : va - vb;
  });
  sortAmountDesc = !sortAmountDesc;
  renderTable(lastData);
  updateKPI();
}

function sortByCount(){
  const countHeader = document.getElementById('countHeaderSelect').value;
  if (!countHeader) return toast('ยังไม่ได้เลือกคอลัมน์จำนวนครั้ง');
  lastData.sort((a,b)=>{
    const va = isNumeric(a[countHeader]) ? toNumber(a[countHeader]) : -Infinity;
    const vb = isNumeric(b[countHeader]) ? toNumber(b[countHeader]) : -Infinity;
    return sortCountDesc ? vb - va : va - vb;
  });
  sortCountDesc = !sortCountDesc;
  renderTable(lastData);
  updateKPI();
}

async function exportPDF(){
  if (!Array.isArray(lastData) || lastData.length===0) return toast('ไม่มีข้อมูลสำหรับรายงาน');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'p', unit:'pt', format:'a4' });

  const marginX = 42, marginY = 48;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('WDBank — รายงาน TOP 10 บัญชีฝากเงิน', marginX, marginY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`ออมก่อนใช้ • วันที่ ${thaiDateString()}`, marginX, marginY+18);

  // KPI line
  const amountHeader = document.getElementById('amountHeaderSelect').value;
  if (amountHeader){
    const sum = lastData.reduce((acc, r)=> acc + (isNumeric(r[amountHeader])? toNumber(r[amountHeader]) : 0), 0);
    doc.text(`ยอดรวมเงินฝากทั้งหมด: ${fmtNumber(sum)} บาท`, marginX, marginY+36);
  }

  // Table (current top 10 view)
  const headers = [tableHeaders];
  const body = lastData.slice(0,10).map(row => tableHeaders.map(h => {
    if (isAccountHeader(h)) return String(row[h] ?? '');
    return isNumeric(row[h]) ? fmtNumber(row[h]) : String(row[h] ?? '');
  }));

  doc.autoTable({
    startY: marginY + 52,
    head: headers,
    body,
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 4, halign: 'center' },
    headStyles: { fillColor: [37, 99, 235], halign:'center' },
    theme: 'grid',
    margin: { left: marginX, right: marginX }
  });

  doc.setFontSize(9);
  doc.text('เอกสารนี้สร้างจากระบบ WDBank (ออมก่อนใช้)', marginX, doc.internal.pageSize.getHeight() - 30);

  doc.save(`WDBank-รายงานTOP10-${new Date().toISOString().slice(0,10)}.pdf`);
}

// === Bottom Sheet ===
function openSheet(){ document.getElementById('profileSheet').classList.remove('hidden'); }
function closeSheet(){ document.getElementById('profileSheet').classList.add('hidden'); }

// === Events ===
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('todayThai').textContent = thaiDateString();
  document.getElementById('asOfThai').textContent  = thaiDateString();
  loadData();
  loadProfile();

  document.getElementById('btnShare').addEventListener('click', shareToLine);
  document.getElementById('sortAmount').addEventListener('click', sortByAmount);
  document.getElementById('sortCount').addEventListener('click', sortByCount);
  document.getElementById('btnExportPDF').addEventListener('click', exportPDF);
  document.getElementById('amountHeaderSelect').addEventListener('change', ()=>{ updateKPI(); renderTable(lastData); });
  document.getElementById('countHeaderSelect').addEventListener('change', ()=>{ /* no-op */ });
});
