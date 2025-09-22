
const SHEET_URL = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortบัญชีเงินมากและฝากมากกว่าหรือเท่ากับค่าเฉลี่ย';
const LIFF_ID   = '2005230346-2OVa774O';

let tableHeaders = [];
let lastData = [];
let lastTop10 = [];
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
  const sum = lastTop10.reduce((acc, r) => {
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
    lastTop10 = lastData.slice(0,10);
    renderTable(lastTop10);
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
      lastTop10 = lastData.slice(0,10);
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

  const flex = buildFlexFromData(lastTop10);
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

// === PDF (Thai-safe via html2canvas) ===
function buildPDFReportNode(){
  const wrap = document.getElementById('pdfReport');
  wrap.innerHTML = '';

  const h1 = document.createElement('h1');
  h1.textContent = 'WDBank — รายงาน TOP 10 บัญชีฝากเงิน';
  wrap.appendChild(h1);

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `ออมก่อนใช้ • วันที่ ${thaiDateString()}`;
  wrap.appendChild(meta);

  // KPI
  const amountHeader = document.getElementById('amountHeaderSelect').value;
  let sum = 0;
  if (amountHeader){
    sum = lastTop10.reduce((acc, r)=> acc + (isNumeric(r[amountHeader])? toNumber(r[amountHeader]):0), 0);
  }
  const kpi = document.createElement('div');
  kpi.className = 'kpi';
  kpi.textContent = `ยอดรวมเงินฝากทั้งหมด (Top 10): ${fmtNumber(sum)} บาท`;
  wrap.appendChild(kpi);

  // Table
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  tableHeaders.forEach(h=>{
    const th = document.createElement('th'); th.textContent = h; trh.appendChild(th);
  });
  thead.appendChild(trh); table.appendChild(thead);

  const tbody = document.createElement('tbody');
  lastTop10.forEach(row=>{
    const tr = document.createElement('tr');
    tableHeaders.forEach(h=>{
      const td = document.createElement('td');
      const v = row[h];
      td.textContent = isAccountHeader(h) ? String(v ?? '') : (isNumeric(v) ? fmtNumber(v) : String(v ?? ''));
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);

  return wrap;
}

async function exportPDF(){
  if (!Array.isArray(lastTop10) || lastTop10.length===0) return toast('ไม่มีข้อมูลสำหรับรายงาน');
  const reportNode = buildPDFReportNode();
  const canvas = await html2canvas(reportNode, { scale: 2, backgroundColor: '#ffffff' });
  const imgData = canvas.toDataURL('image/png');

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
  const pageWidth  = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const margin = 24;
  const imgWidth = pageWidth - margin*2;
  const imgHeight = canvas.height * imgWidth / canvas.width;

  if (imgHeight <= pageHeight - margin*2){
    pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
  }else{
    let sH = 0;
    const pageCanvas = document.createElement('canvas');
    const ctx = pageCanvas.getContext('2d');
    const ratio = imgWidth / canvas.width;
    const sliceHeightPx = (pageHeight - margin*2) / ratio;

    while (sH < canvas.height){
      const slice = Math.min(sliceHeightPx, canvas.height - sH);
      pageCanvas.width  = canvas.width;
      pageCanvas.height = slice;
      ctx.drawImage(canvas, 0, sH, canvas.width, slice, 0, 0, canvas.width, slice);
      const sliceData = pageCanvas.toDataURL('image/png');
      const sliceHpt = slice * ratio;

      pdf.addImage(sliceData, 'PNG', margin, margin, imgWidth, sliceHpt);
      sH += slice;
      if (sH < canvas.height) pdf.addPage();
    }
  }

  pdf.save(`WDBank-รายงานTOP10-${new Date().toISOString().slice(0,10)}.pdf`);
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
  document.getElementById('btnExportPDF').addEventListener('click', exportPDF);
  document.getElementById('amountHeaderSelect').addEventListener('change', ()=>{ updateKPI(); });
  document.getElementById('countHeaderSelect').addEventListener('change', ()=>{ /* no-op */ });
});
