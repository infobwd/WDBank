// ---------------- Config ----------------
const LIFF_ID = '2005230346-2OVa774O'; // <-- แก้เป็น LIFF จริงของพี่ที่รัก
// Endpoints
const SHEET_AMOUNT      = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortบัญชีเงินมากและฝากมากกว่าหรือเท่ากับค่าเฉลี่ย';
const SHEET_FREQUENT    = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortบัญชีฝากถี่มาก';
const SHEET_DEPOSITONLY = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortบัญชีไม่ถอนและฝากมากกว่าหรือเท่ากับค่าเฉลี่ย';
const SHEET_TX          = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortรายการฝากและถอน';
const SHEET_ACCOUNTS    = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo//บัญชี';

// ---------------- State ----------------
let H_AMOUNT=[], H_FREQ=[], H_DEP=[];
let D_AMOUNT=[], D_FREQ=[], D_DEP=[];
let TOP_AMOUNT=[], TOP_FREQ=[], TOP_DEP=[];
let TX = []; let AC = [];

// ---------------- Utils ----------------
const isNumeric = (val) => { if (val === null || val === undefined) return false; const n = Number(String(val).replace(/[, ]/g,'')); return Number.isFinite(n); };
const toNumber = (val) => Number(String(val).replace(/[, ]/g,''));
const fmtNumber = (val) => { const n = Number(String(val).replace(/[, ]/g,'')); return Number.isFinite(n) ? n.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : String(val ?? ''); };
const cut = (s, len) => String(s ?? '').length > len ? String(s).slice(0, len - 1) + '…' : String(s ?? '');
const thaiDateString = (d=new Date()) => d.toLocaleDateString('th-TH', { year:'numeric', month:'long', day:'numeric' });
function isAccountHeader(h){ return /(เลข\s*บัญชี|บัญชี|account)/i.test(String(h)); }
function isCountHeader(h){ return /(จำนวน|ครั้ง|count)/i.test(String(h)); }
function isBalanceHeader(h){ return /(คงเหลือ|ยอดคงเหลือ|ยอด|รวม|amount|total|เงิน)/i.test(String(h)); }
function isClassHeader(h){ return /(ชั้น|ห้อง|class)/i.test(String(h)); }
function formatAccountMasked(val){ const raw = String(val ?? '').replace(/\s+/g, '').replace(/,/g,''); const first = raw.slice(0,4); const last2 = raw.slice(-2); return `${first} •••• ••${last2}`.trim(); }
function headersOf(rows){ return Object.keys(rows?.[0]||{}); }

// class style mapping (bank-like icons)
const CLASS_STYLE = {
  'ป.1': { bg:'#fef3c7', fg:'#92400e', icon:'fa-seedling' },
  'ป.2': { bg:'#ecfccb', fg:'#166534', icon:'fa-leaf' },
  'ป.3': { bg:'#dbeafe', fg:'#1e40af', icon:'fa-pencil' },
  'ป.4': { bg:'#fae8ff', fg:'#6b21a8', icon:'fa-puzzle-piece' },
  'ป.5': { bg:'#fde68a', fg:'#92400e', icon:'fa-star' },
  'ป.6': { bg:'#cffafe', fg:'#155e75', icon:'fa-graduation-cap' },
};
function classStyle(cls){ return CLASS_STYLE[cls] || { bg:'#f1f5f9', fg:'#334155', icon:'fa-user' }; }

// skeleton
function clearSkeleton(){ document.querySelectorAll('.sk').forEach(el=>el.classList.remove('sk')); }

// ---------------- Rendering ----------------
function renderTable(headEl, bodyEl, rows){
  headEl.innerHTML=''; bodyEl.innerHTML='';
  if (!rows?.length){ headEl.innerHTML='<th>ข้อมูล</th>'; bodyEl.innerHTML='<tr><td>ไม่พบข้อมูล</td></tr>'; return; }
  const headers = headersOf(rows);
  headers.forEach(h=>{ const th=document.createElement('th'); th.textContent=h; headEl.appendChild(th); });
  rows.forEach(r=>{
    const tr=document.createElement('tr');
    headers.forEach(h=>{
      const td=document.createElement('td');
      const raw=r[h];
      if (isAccountHeader(h)){ const span=document.createElement('span'); span.className='acc-pill'; span.textContent=formatAccountMasked(raw); td.appendChild(span); }
      else if (isNumeric(raw)){ td.textContent=fmtNumber(raw); }
      else { td.textContent=String(raw ?? ''); }
      tr.appendChild(td);
    });
    bodyEl.appendChild(tr);
  });
}

function getAccountKey(headers, row){ const accHeader = headers.find(isAccountHeader); return String(accHeader ? row[accHeader] : Object.values(row)[0] ?? '').trim(); }

function renderAllStars(){
  const wrap = document.getElementById('allstars'); wrap.innerHTML='';
  if (!TOP_AMOUNT.length || !TOP_FREQ.length || !TOP_DEP.length){ wrap.innerHTML='<div class="subtitle">ยังไม่พอสร้างการ์ดสรุป</div>'; return; }
  const A = new Map(TOP_AMOUNT.map(r => [getAccountKey(H_AMOUNT, r), r]));
  const B = new Map(TOP_FREQ.map(r => [getAccountKey(H_FREQ, r), r]));
  const C = new Map(TOP_DEP.map(r => [getAccountKey(H_DEP, r), r]));
  const keysA = Array.from(A.keys());
  const intersection = keysA.filter(k => B.has(k) && C.has(k)).slice(0,3);

  const balanceH = H_AMOUNT.find(isBalanceHeader) || H_FREQ.find(isBalanceHeader) || H_DEP.find(isBalanceHeader);
  const countH   = H_AMOUNT.find(isCountHeader)   || H_FREQ.find(isCountHeader)   || H_DEP.find(isCountHeader);
  const classH   = H_AMOUNT.find(isClassHeader)   || H_FREQ.find(isClassHeader)   || H_DEP.find(isClassHeader);

  intersection.forEach(key=>{
    const rA = A.get(key) || {}; const rB = B.get(key) || {}; const rC = C.get(key) || {};
    const cls = (classH && (rA[classH]||rB[classH]||rC[classH])) ? String(rA[classH]||rB[classH]||rC[classH]) : 'ไม่ระบุ';
    const style = classStyle(cls);
    const amountTxt = balanceH ? (isNumeric(rA[balanceH]||rB[balanceH]||rC[balanceH])? fmtNumber(rA[balanceH]||rB[balanceH]||rC[balanceH]) : '-') : '-';
    const countTxt  = countH   ? (isNumeric(rA[countH]||rB[countH]||rC[countH])?  fmtNumber(rA[countH]||rB[countH]||rC[countH]) : '-') : '-';

    const card = document.createElement('div'); card.className='star-card';
    card.innerHTML = `
      <div class="class-tag" style="background:${style.bg}; color:${style.fg}"><i class="fa-solid ${style.icon}"></i> ${cls}</div>
      <div class="star-hdr">
        <i class="fa-solid fa-trophy" style="color:#eab308"></i>
        <div>
          <div class="star-acc">${formatAccountMasked(key)}</div>
          <div class="star-badges">
            <span class="badge blue"><i class="fa-solid fa-baht-sign"></i> ยอดเงินสูง</span>
            <span class="badge green"><i class="fa-solid fa-clock-rotate-left"></i> ฝากถี่</span>
            <span class="badge purple"><i class="fa-solid fa-ban"></i> ไม่เคยถอน</span>
          </div>
        </div>
      </div>
      <div class="subtitle">ยอดคงเหลือโดยประมาณ: <strong>${amountTxt}</strong> บาท • จำนวนครั้งฝาก: <strong>${countTxt}</strong></div>
    `;
    wrap.appendChild(card);
  });
}

// Latest10 table with colored badges
function parseThaiDate(s){
  try{
    const [datePart, timePart='00:00:00'] = String(s).split(',').map(t=>t.trim());
    const [d,m,y] = datePart.split('/').map(x=>parseInt(x,10));
    const [hh,mm,ss] = timePart.split(':').map(x=>parseInt(x,10));
    const gy = (y>2400) ? y-543 : y;
    return new Date(gy, m-1, d, hh||0, mm||0, ss||0);
  }catch(e){ return null; }
}
function isThisWeek(date){
  if (!date) return false;
  const now = new Date();
  const start = new Date(now);
  const day = (now.getDay()+6)%7; // Monday=0
  start.setDate(now.getDate() - day);
  start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(start.getDate()+7);
  return date >= start && date < end;
}
function isThisMonth(date){
  if (!date) return false;
  const now = new Date();
  return date.getFullYear()===now.getFullYear() && date.getMonth()===now.getMonth();
}
function renderLatest10(){
  const rows = TX.map(r=>({ ...r, __d: parseThaiDate(r['วันที่']) })).filter(r=>r.__d).sort((a,b)=>b.__d - a.__d).slice(0,10);
  const headers = ['วันที่','บัญชี','รายการ','จำนวนเงิน','ชั้น'];
  const thead = document.getElementById('th-latest');
  const tbody = document.getElementById('tb-latest');
  thead.innerHTML=''; tbody.innerHTML='';
  headers.forEach(h=>{ const th=document.createElement('th'); th.textContent=h; thead.appendChild(th); });
  rows.forEach(r=>{
    const tr=document.createElement('tr');
    const act = String(r['รายการ']||'');
    const badge = `<span class="badge-act ${act==='ฝาก'?'badge-dep':'badge-wdr'}"><i class="fa-solid ${act==='ฝาก'?'fa-arrow-down':'fa-arrow-up'}"></i> ${act}</span>`;
    const cells = [
      r['วันที่']||'',
      formatAccountMasked(r['บัญชี']||''),
      '', // badge
      fmtNumber(r['จำนวนเงิน']||''),
      r['ชั้น']||r['ห้อง']||''
    ];
    cells.forEach((v,i)=>{
      const td=document.createElement('td');
      if (i===2){ td.innerHTML = badge; } else { td.textContent=String(v); }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

// ---------------- Data Loading with retry ----------------
async function fetchJSON(url, { timeout=12000, retries=2 } = {}){
  const attempt = async () => {
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), timeout);
    try{
      const res = await fetch(url + (url.includes('?')?'&':'?') + '_ts=' + Date.now(), { signal: ctrl.signal, cache:'no-store' });
      clearTimeout(t);
      if (!res.ok) throw new Error('HTTP '+res.status);
      return await res.json();
    }catch(e){
      clearTimeout(t); throw e;
    }
  };
  for (let i=0;i<=retries;i++){
    try{ return await attempt(); }catch(err){
      if (i===retries) throw err;
      await new Promise(r=>setTimeout(r, 600*(i+1)));
    }
  }
}

async function loadAll(){
  document.getElementById('todayThai').textContent = thaiDateString();
  try{
    D_AMOUNT = await fetchJSON(SHEET_AMOUNT);
    D_FREQ   = await fetchJSON(SHEET_FREQUENT);
    D_DEP    = await fetchJSON(SHEET_DEPOSITONLY);
    TX       = await fetchJSON(SHEET_TX);
    AC       = await fetchJSON(SHEET_ACCOUNTS);
  }catch(e){
    console.error('โหลดข้อมูลล้มเหลว', e);
    Swal.fire('เกิดข้อผิดพลาด', 'มีปัญหาในการโหลดข้อมูลบางส่วน โปรดลองใหม่อีกครั้ง', 'error');
  }

  H_AMOUNT=headersOf(D_AMOUNT); H_FREQ=headersOf(D_FREQ); H_DEP=headersOf(D_DEP);
  TOP_AMOUNT=D_AMOUNT.slice(0,10); TOP_FREQ=D_FREQ.slice(0,10); TOP_DEP=D_DEP.slice(0,10);

  renderTable(document.getElementById('th-amount'), document.getElementById('tb-amount'), TOP_AMOUNT);
  renderTable(document.getElementById('th-frequent'), document.getElementById('tb-frequent'), TOP_FREQ);
  renderTable(document.getElementById('th-depositonly'), document.getElementById('tb-depositonly'), TOP_DEP);

  renderAllStars();
  renderWeeklyKPIs();
  renderLatest10();

  clearSkeleton();
}

// ---------------- KPIs ----------------
function renderWeeklyKPIs(){
  let depCount=0, wdrCount=0, depAmt=0, wdrAmt=0;
  const classCount = new Map();

  TX.forEach(r=>{
    const d = parseThaiDate(r['วันที่']);
    if (!isThisWeek(d)) return;
    const act = String(r['รายการ']||'').trim();
    const amt = toNumber(r['จำนวนเงิน']);
    const cls = String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ');

    if (act==='ฝาก'){ depCount++; depAmt += Number.isFinite(amt)? amt:0; }
    else if (act==='ถอน'){ wdrCount++; wdrAmt += Number.isFinite(amt)? amt:0; }

    classCount.set(cls, (classCount.get(cls)||0)+1);
  });

  let topClass='-', topClassCount=0;
  for (const [k,v] of classCount.entries()){ if (v>topClassCount){ topClass=k; topClassCount=v; } }

  document.getElementById('kpiDepCount').textContent = depCount.toLocaleString('th-TH') + ' ครั้ง';
  document.getElementById('kpiDepAmt').textContent   = 'รวม ' + fmtNumber(depAmt) + ' บาท';
  document.getElementById('kpiWdrCount').textContent = wdrCount.toLocaleString('th-TH') + ' ครั้ง';
  document.getElementById('kpiWdrAmt').textContent   = 'รวม ' + fmtNumber(wdrAmt) + ' บาท';
  const net = depAmt - wdrAmt;
  document.getElementById('kpiNet').textContent = fmtNumber(net) + ' บาท';
  document.getElementById('kpiTopClass').textContent = topClass;
  document.getElementById('kpiTopClassDetail').textContent = topClass==='-'? '-' : (topClassCount.toLocaleString('th-TH') + ' ครั้งสัปดาห์นี้');
}

// ---------------- LIFF ----------------
async function ensureLogin(){
  try{ await liff.init({ liffId: LIFF_ID }); }catch(e){ /* Web outside LINE ok */ }
  if (!liff.isLoggedIn()){
    await Swal.fire({ title:'ต้องเข้าสู่ระบบ LINE', text:'เพื่อแชร์ผ่าน LINE จำเป็นต้องเข้าสู่ระบบก่อน', icon:'info', confirmButtonText:'เข้าสู่ระบบ' });
    liff.login({ redirectUri: location.href });
    throw new Error('login-redirect');
  }
}
async function loadProfileAvatar(){
  try{
    await liff.init({ liffId: LIFF_ID });
    if (liff.isLoggedIn()){
      const p = await liff.getProfile();
      if (p?.pictureUrl) document.getElementById('avatar').src = p.pictureUrl;
      document.getElementById('loginBadge').classList.remove('show');
    }else{
      document.getElementById('loginBadge').classList.add('show');
    }
  }catch(e){ document.getElementById('loginBadge').classList.add('show'); }
}

// ---------------- Share Flex ----------------
function buildFlexFromRows(title, rows){
  if (!rows?.length) return null;
  const headers = Object.keys(rows[0]);
  const headerBox = { type:'box', layout:'horizontal', contents: headers.map(h=>({type:'text', text: cut(h,12), size:'xs', weight:'bold', align:'center', flex:1})) };
  const dataRows = rows.map((r,i)=>({
    type:'box', layout:'horizontal', backgroundColor: i%2? '#FFFFFF':'#F5F6FA',
    contents: headers.map(h=>({ type:'text', text: cut(isAccountHeader(h)? formatAccountMasked(r[h]) : (isNumeric(r[h])? fmtNumber(r[h]): (r[h] ?? '')), 16), size:'xs', align:'center', flex:1 }))
  }));
  return {
    type:'flex', altText:title,
    contents:{ type:'bubble', size:'giga',
      body:{ type:'box', layout:'vertical', contents:[
        { type:'text', text:title, weight:'bold', size:'lg' },
        { type:'text', text:`ออมก่อนใช้ • ${thaiDateString()}`, color:'#7286D3', size:'sm' },
        { type:'separator', margin:'md' },
        headerBox,
        { type:'separator', margin:'sm' },
        { type:'box', layout:'vertical', margin:'md', spacing:'sm', contents:dataRows }
      ]}
    }
  };
}
async function shareAmount(){ await ensureLogin(); const flex = buildFlexFromRows('WDBank • TOP 10 ยอดเงินสูง', TOP_AMOUNT); await liff.shareTargetPicker([flex]); liff.closeWindow && liff.closeWindow(); }
async function shareFrequent(){ await ensureLogin(); const flex = buildFlexFromRows('WDBank • TOP 10 ฝากถี่มาก', TOP_FREQ); await liff.shareTargetPicker([flex]); liff.closeWindow && liff.closeWindow(); }
async function shareDepositOnly(){ await ensureLogin(); const flex = buildFlexFromRows('WDBank • TOP 10 ไม่เคยถอน (ฝาก ≥ ค่าเฉลี่ย)', TOP_DEP); await liff.shareTargetPicker([flex]); liff.closeWindow && liff.closeWindow(); }
async function shareAllStars(){
  await ensureLogin();
  const acc = (rows, headers)=> rows.map(r=>({ key: String((headers.find(isAccountHeader)||'')? r[headers.find(isAccountHeader)] : Object.values(r)[0]).trim(), row:r }));
  const A = acc(TOP_AMOUNT,H_AMOUNT), B = acc(TOP_FREQ,H_FREQ), C = acc(TOP_DEP,H_DEP);
  const keysA = new Set(A.map(x=>x.key));
  const keysB = new Set(B.map(x=>x.key));
  const keysC = new Set(C.map(x=>x.key));
  const inter = [...keysA].filter(k=>keysB.has(k)&&keysC.has(k)).slice(0,3).map(k=>({key:k}));
  const headers=['เลขบัญชี','คุณสมบัติ'];
  const headerBox={type:'box', layout:'horizontal', contents: headers.map(h=>({type:'text', text:h, size:'xs', weight:'bold', align:'center', flex:1}))};
  const dataRows = inter.map((r,i)=>({
    type:'box', layout:'horizontal', backgroundColor: i%2? '#FFFFFF':'#F5F6FA',
    contents:[
      { type:'text', text: cut(formatAccountMasked(r.key),18), size:'xs', align:'center', flex:1 },
      { type:'text', text: 'ยอดสูง • ฝากถี่ • ไม่เคยถอน', size:'xs', align:'center', flex:1 }
    ]
  }));
  const flex = { type:'flex', altText:'WDBank • 3 บัญชีเด่น', contents:{ type:'bubble', size:'giga', body:{ type:'box', layout:'vertical', contents:[
      { type:'text', text:'WDBank • 3 บัญชีเด่น', weight:'bold', size:'lg' },
      { type:'text', text:`ออมก่อนใช้ • ${thaiDateString()}`, color:'#7286D3', size:'sm' },
      { type:'separator', margin:'md' }, headerBox, { type:'separator', margin:'sm' },
      { type:'box', layout:'vertical', margin:'md', spacing:'sm', contents:dataRows }
  ]}}};
  await liff.shareTargetPicker([flex]); liff.closeWindow && liff.closeWindow();
}

// ---------------- PDF Core ----------------
function buildPDFShell(title){
  const wrap = document.createElement('div');
  // header with crest
  const header = document.createElement('div'); header.className='header';
  const img = document.createElement('img'); img.src='./assets/crest.svg'; img.alt='ตราโรงเรียน';
  const h1 = document.createElement('h1'); h1.textContent = title;
  header.appendChild(img); header.appendChild(h1);
  wrap.appendChild(header);
  const meta = document.createElement('div'); meta.className='meta'; meta.textContent = `WDBank • ออมก่อนใช้ • วันที่ ${thaiDateString()}`; wrap.appendChild(meta);
  return wrap;
}
function addSignatureBlock(wrap){
  const row = document.createElement('div'); row.className='sign-row';
  const left = document.createElement('div'); left.className='sign';
  left.innerHTML = `<div class="line"></div><div>ผู้บริหารสถานศึกษา (ลงชื่อ)</div>`;
  const right = document.createElement('div'); right.className='sign';
  right.innerHTML = `<div class="line"></div><div>ผู้รับผิดชอบงานธนาคารโรงเรียน (ลงชื่อ)</div>`;
  row.appendChild(left); row.appendChild(right);
  wrap.appendChild(row);
}
async function renderPDF(node, filename){
  const report = document.getElementById('pdfReport');
  report.innerHTML=''; report.appendChild(node);
  const canvas = await html2canvas(report, { scale: 2, backgroundColor:'#ffffff' });
  const imgData = canvas.toDataURL('image/png');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation:'p', unit:'pt', format:'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
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
  pdf.save(filename);
}
function buildPDFTable(headers, rows){
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  headers.forEach(h=>{ const th=document.createElement('th'); th.textContent=h; trh.appendChild(th); });
  thead.appendChild(trh); table.appendChild(thead);
  const tbody = document.createElement('tbody');
  rows.forEach(r=>{
    const tr=document.createElement('tr');
    headers.forEach(h=>{
      const td=document.createElement('td');
      const v=r[h];
      const text = isAccountHeader(h) ? formatAccountMasked(v) : (isNumeric(v)? fmtNumber(v): String(v ?? ''));
      td.textContent = text; tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

// Existing exports (Top10 + Summary)
async function exportPDF(which){
  let title='', headers=[], rows=[];
  if (which==='amount'){ title='รายงาน TOP 10 ยอดเงินสูง • ฝาก ≥ ค่าเฉลี่ย'; headers=headersOf(TOP_AMOUNT); rows=TOP_AMOUNT; }
  if (which==='frequent'){ title='รายงาน TOP 10 บัญชีฝากถี่มาก'; headers=headersOf(TOP_FREQ); rows=TOP_FREQ; }
  if (which==='depositonly'){ title='รายงาน TOP 10 ไม่เคยถอน • ฝาก ≥ ค่าเฉลี่ย'; headers=headersOf(TOP_DEP); rows=TOP_DEP; }
  if (!rows.length){ return alert('ไม่มีข้อมูลสำหรับรายงาน'); }
  const wrap = buildPDFShell(title);
  wrap.appendChild(buildPDFTable(headers, rows));
  addSignatureBlock(wrap);
  await renderPDF(wrap, `WDBank-${which}-${new Date().toISOString().slice(0,10)}.pdf`);
}

function parseDateRangeFilter(kind){
  const now=new Date(); let start, end;
  if (kind==='week'){ start = new Date(now); const day=(now.getDay()+6)%7; start.setDate(now.getDate()-day); start.setHours(0,0,0,0); end = new Date(start); end.setDate(start.getDate()+7); }
  else if (kind==='month'){ start = new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0); end   = new Date(now.getFullYear(), now.getMonth()+1, 1, 0,0,0,0); }
  return {start, end};
}
function inRange(d, start, end){ return d && d>=start && d<end; }

function buildTxInsightsRange(start,end){
  let depCount=0, wdrCount=0, depAmt=0, wdrAmt=0;
  const classCount = new Map();
  TX.forEach(r=>{
    const d = parseThaiDate(r['วันที่']); if (!inRange(d,start,end)) return;
    const act = String(r['รายการ']||'').trim();
    const amt = toNumber(r['จำนวนเงิน']);
    const cls = String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ');
    if (act==='ฝาก'){ depCount++; depAmt += Number.isFinite(amt)? amt:0; }
    else if (act==='ถอน'){ wdrCount++; wdrAmt += Number.isFinite(amt)? amt:0; }
    classCount.set(cls, (classCount.get(cls)||0)+1);
  });
  let topClass='-', topClassCount=0;
  for (const [k,v] of classCount.entries()){ if (v>topClassCount){ topClass=k; topClassCount=v; } }
  const net = depAmt - wdrAmt;
  const text = `ช่วงข้อมูล: ${thaiDateString(start)} – ${thaiDateString(end)}
• ฝาก: ${depCount.toLocaleString('th-TH')} ครั้ง (รวม ${fmtNumber(depAmt)} บาท)
• ถอน: ${wdrCount.toLocaleString('th-TH')} ครั้ง (รวม ${fmtNumber(wdrAmt)} บาท)
• เงินไหลสุทธิ (ฝาก-ถอน): ${fmtNumber(net)} บาท
• ชั้นที่เคลื่อนไหวสูงสุด: ${topClass} (${topClassCount.toLocaleString('th-TH')} ครั้ง)`;
  const div=document.createElement('div'); div.className='insight'; div.innerHTML = `<strong>สรุปช่วงเวลา</strong><br>${text.replace(/\n/g,'<br>')}`;
  return { node: div };
}

async function exportSummaryPDF(kind){
  const {start, end} = parseDateRangeFilter(kind);
  const wrap = buildPDFShell(kind==='week'?'สรุปรายสัปดาห์':'สรุปรายเดือน');
  const insight = buildTxInsightsRange(start,end);
  if (insight.node) wrap.appendChild(insight.node);

  const classAgg = new Map();
  TX.forEach(r=>{
    const d = parseThaiDate(r['วันที่']); if (!inRange(d,start,end)) return;
    const cls = String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ');
    const act = String(r['รายการ']||'').trim();
    const amt = toNumber(r['จำนวนเงิน']);
    const obj = classAgg.get(cls) || { ฝาก:0, ถอน:0, ครั้งฝาก:0, ครั้งถอน:0 };
    if (act==='ฝาก'){ obj.ฝาก += Number.isFinite(amt)? amt:0; obj.ครั้งฝาก++; }
    else if (act==='ถอน'){ obj.ถอน += Number.isFinite(amt)? amt:0; obj.ครั้งถอน++; }
    classAgg.set(cls, obj);
  });

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>ชั้น</th><th>ครั้งฝาก</th><th>ครั้งถอน</th><th>รวมฝาก</th><th>รวมถอน</th><th>สุทธิ</th></tr>';
  const tbody = document.createElement('tbody');
  for (const [cls,v] of classAgg.entries()){
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${cls}</td><td>${fmtNumber(v.ครั้งฝาก)}</td><td>${fmtNumber(v.ครั้งถอน)}</td><td>${fmtNumber(v.ฝาก)}</td><td>${fmtNumber(v.ถอน)}</td><td>${fmtNumber(v.ฝาก - v.ถอน)}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(thead); table.appendChild(tbody);
  wrap.appendChild(table);
  addSignatureBlock(wrap);
  await renderPDF(wrap, `WDBank-summary-${kind}-${new Date().toISOString().slice(0,10)}.pdf`);
}

// New: Class balance PDF
function buildClassBalanceSummary(){
  const rows = Array.isArray(AC)? AC: [];
  const result = new Map();
  rows.forEach(r=>{
    const cls = String(r['ห้อง']||r['ชั้น']||'ไม่ระบุ');
    const dep = toNumber(r['ฝาก']);
    const wdr = toNumber(r['ถอน']);
    const bal = toNumber(r['จำนวนเงินคงเหลือ']);
    const depC = toNumber(r['จำนวนครั้งที่ฝาก']);
    const wdrC = toNumber(r['จำนวนครั้งที่ถอน']);
    const obj = result.get(cls) || { ฝาก:0, ถอน:0, คงเหลือ:0, ครั้งฝาก:0, ครั้งถอน:0, บัญชี:0 };
    obj.ฝาก += Number.isFinite(dep)? dep:0;
    obj.ถอน += Number.isFinite(wdr)? wdr:0;
    obj.คงเหลือ += Number.isFinite(bal)? bal:0;
    obj.ครั้งฝาก += Number.isFinite(depC)? depC:0;
    obj.ครั้งถอน += Number.isFinite(wdrC)? wdrC:0;
    obj.บัญชี += 1;
    result.set(cls, obj);
  });
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>ชั้น</th><th>จำนวนบัญชี</th><th>รวมฝาก</th><th>รวมถอน</th><th>คงเหลือรวม</th><th>ครั้งฝาก</th><th>ครั้งถอน</th></tr>';
  const tbody = document.createElement('tbody');
  for (const [cls, v] of result.entries()){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${cls}</td><td>${fmtNumber(v.บัญชี)}</td><td>${fmtNumber(v.ฝาก)}</td><td>${fmtNumber(v.ถอน)}</td><td>${fmtNumber(v.คงเหลือ)}</td><td>${fmtNumber(v.ครั้งฝาก)}</td><td>${fmtNumber(v.ครั้งถอน)}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(thead); table.appendChild(tbody);
  return table;
}

async function exportClassBalancePDF(){
  const wrap = buildPDFShell('ยอดคงเหลือรวมรายชั้น');
  wrap.appendChild(buildClassBalanceSummary());
  addSignatureBlock(wrap);
  await renderPDF(wrap, `WDBank-class-balance-${new Date().toISOString().slice(0,10)}.pdf`);
}

// New: Savings-only (ออมสิน TRUE) PDF
async function exportSavingsPDF(){
  const rows = Array.isArray(AC)? AC: [];
  const filtered = rows.filter(r => String(r['ออมสิน']||'').toUpperCase()==='TRUE');
  if (!filtered.length){ return alert('ไม่มีบัญชีที่เป็นออมสิน (TRUE)'); }

  const wrap = buildPDFShell('บัญชีสำหรับนำฝากต่อธนาคารออมสิน');
  // summary
  let sumBal=0, sumDep=0, sumWdr=0, count=filtered.length;
  filtered.forEach(r=>{
    sumBal += Number.isFinite(toNumber(r['จำนวนเงินคงเหลือ'])) ? toNumber(r['จำนวนเงินคงเหลือ']) : 0;
    sumDep += Number.isFinite(toNumber(r['ฝาก'])) ? toNumber(r['ฝาก']) : 0;
    sumWdr += Number.isFinite(toNumber(r['ถอน'])) ? toNumber(r['ถอน']) : 0;
  });
  const info = document.createElement('div'); info.className='insight';
  info.innerHTML = `<strong>สรุป</strong><br>
  จำนวนนำส่ง: ${fmtNumber(count)} บัญชี<br>
  รวมฝาก: ${fmtNumber(sumDep)} บาท • รวมถอน: ${fmtNumber(sumWdr)} บาท<br>
  คงเหลือรวม: ${fmtNumber(sumBal)} บาท`;
  wrap.appendChild(info);

  // table
  const headers = ['บัญชี','ห้อง','ฝาก','ถอน','จำนวนเงินคงเหลือ','สถานะบัญชี'];
  const rowsOut = filtered.map(r=>({
    'บัญชี': formatAccountMasked(r['รหัสนักเรียน']||r['บัญชี']||''),
    'ห้อง': r['ห้อง']||r['ชั้น']||'',
    'ฝาก': fmtNumber(r['ฝาก']),
    'ถอน': fmtNumber(r['ถอน']),
    'จำนวนเงินคงเหลือ': fmtNumber(r['จำนวนเงินคงเหลือ']),
    'สถานะบัญชี': r['สถานะบัญชี']||''
  }));
  wrap.appendChild(buildPDFTable(headers, rowsOut));
  addSignatureBlock(wrap);
  await renderPDF(wrap, `WDBank-savings-gsb-${new Date().toISOString().slice(0,10)}.pdf`);
}

// ---------------- Events ----------------
function bindNav(){
  // bottom nav tab switching
  document.querySelectorAll('.nav-btn[data-tab]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const tab = btn.getAttribute('data-tab');
      document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p=>p.classList.remove('show'));
      document.querySelector(`.tab[data-tab="${tab}"]`)?.classList.add('active');
      document.getElementById('panel-'+tab)?.classList.add('show');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
  // open/close reports hub
  const open = document.getElementById('openReports');
  const close = document.getElementById('closeReports');
  const modal = document.getElementById('reportsModal');
  open.addEventListener('click', ()=> modal.classList.remove('hidden'));
  close.addEventListener('click', ()=> modal.classList.add('hidden'));
  modal.addEventListener('click', (e)=>{ if (e.target===modal) modal.classList.add('hidden'); });
}

document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('todayThai').textContent = thaiDateString();
  loadAll();
  loadProfileAvatar();
  bindNav();

  // Tabs (header)
  document.querySelectorAll('.tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p=>p.classList.remove('show'));
      btn.classList.add('active');
      document.getElementById('panel-'+btn.dataset.tab).classList.add('show');
    });
  });

  // Share buttons
  document.getElementById('share-amount').addEventListener('click', shareAmount);
  document.getElementById('share-frequent').addEventListener('click', shareFrequent);
  document.getElementById('share-depositonly').addEventListener('click', shareDepositOnly);
  document.getElementById('share-allstars').addEventListener('click', shareAllStars);

  // PDF buttons in sections
  document.getElementById('pdf-amount').addEventListener('click', ()=>exportPDF('amount'));
  document.getElementById('pdf-frequent').addEventListener('click', ()=>exportPDF('frequent'));
  document.getElementById('pdf-depositonly').addEventListener('click', ()=>exportPDF('depositonly'));
  document.getElementById('pdf-week').addEventListener('click', ()=>exportSummaryPDF('week'));
  document.getElementById('pdf-month').addEventListener('click', ()=>exportSummaryPDF('month'));
  document.getElementById('pdf-classsum').addEventListener('click', exportClassBalancePDF);
  document.getElementById('pdf-savings').addEventListener('click', exportSavingsPDF);

  // PDF buttons in Reports hub
  document.getElementById('m-pdf-amount').addEventListener('click', ()=>exportPDF('amount'));
  document.getElementById('m-pdf-frequent').addEventListener('click', ()=>exportPDF('frequent'));
  document.getElementById('m-pdf-deposit').addEventListener('click', ()=>exportPDF('depositonly'));
  document.getElementById('m-pdf-week').addEventListener('click', ()=>exportSummaryPDF('week'));
  document.getElementById('m-pdf-month').addEventListener('click', ()=>exportSummaryPDF('month'));
  document.getElementById('m-pdf-class').addEventListener('click', exportClassBalancePDF);
  document.getElementById('m-pdf-savings').addEventListener('click', exportSavingsPDF);
});
