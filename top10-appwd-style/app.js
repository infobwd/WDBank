// Config (ใช้ LIFF ตัวเดียวสำหรับทั้งหน้า)
const LIFF_ID = '2005230346-2OVa774O';

// Sheet endpoints (Top10)
const SHEET_AMOUNT      = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortบัญชีเงินมากและฝากมากกว่าหรือเท่ากับค่าเฉลี่ย';
const SHEET_FREQUENT    = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortบัญชีฝากถี่มาก';
const SHEET_DEPOSITONLY = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortบัญชีไม่ถอนและฝากมากกว่าหรือเท่ากับค่าเฉลี่ย';

// Transaction (สารสนเทศผู้บริหาร / รายการล่าสุด / KPI สัปดาห์นี้)
const SHEET_TX = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortรายการฝากและถอน';

// Accounts (ข้อมูลห้อง/ชั้นรวม)
const SHEET_ACCOUNTS = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo//บัญชี'; // ใช้ตามที่ผู้ใช้ให้มา (มี //)

let H_AMOUNT=[], H_FREQ=[], H_DEP=[];
let D_AMOUNT=[], D_FREQ=[], D_DEP=[];         // full datasets
let TOP_AMOUNT=[], TOP_FREQ=[], TOP_DEP=[];   // top10 per sheet

let TX = []; // transaction rows
let AC = []; // accounts rows

// Utils
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

function isAccountHeader(h){ return /(เลข\\s*บัญชี|บัญชี|account)/i.test(String(h)); }
function isCountHeader(h){ return /(จำนวน|ครั้ง|count)/i.test(String(h)); }
function isBalanceHeader(h){ return /(คงเหลือ|ยอดคงเหลือ|ยอด|รวม|amount|total|เงิน)/i.test(String(h)); }

// แสดงเลขบัญชีแบบ mask (4 ตัวแรก + 2 ตัวท้าย)
function formatAccountMasked(val){
  const raw = String(val ?? '').replace(/\\s+/g, '').replace(/,/g,'');
  const first = raw.slice(0,4);
  const last2 = raw.slice(-2);
  return `${first} •••• ••${last2}`.trim();
}

function headersOf(rows){ return Object.keys(rows?.[0]||{}); }

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
      if (isAccountHeader(h)){
        const span=document.createElement('span'); span.className='acc-pill'; span.textContent=formatAccountMasked(raw);
        td.appendChild(span);
      }else{
        td.textContent=isNumeric(raw)? fmtNumber(raw): String(raw ?? '');
      }
      tr.appendChild(td);
    });
    bodyEl.appendChild(tr);
  });
}

// Loaders
async function fetchJSON(url){ const res=await fetch(url,{cache:'no-store'}); return res.json(); }

async function loadAll(){
  document.getElementById('todayThai').textContent = thaiDateString();
  [D_AMOUNT, D_FREQ, D_DEP, TX, AC] = await Promise.all([
    fetchJSON(SHEET_AMOUNT), fetchJSON(SHEET_FREQUENT), fetchJSON(SHEET_DEPOSITONLY),
    fetchJSON(SHEET_TX), fetchJSON(SHEET_ACCOUNTS)
  ]);
  H_AMOUNT=headersOf(D_AMOUNT); H_FREQ=headersOf(D_FREQ); H_DEP=headersOf(D_DEP);
  TOP_AMOUNT=D_AMOUNT.slice(0,10); TOP_FREQ=D_FREQ.slice(0,10); TOP_DEP=D_DEP.slice(0,10);

  renderTable(document.getElementById('th-amount'), document.getElementById('tb-amount'), TOP_AMOUNT);
  renderTable(document.getElementById('th-frequent'), document.getElementById('tb-frequent'), TOP_FREQ);
  renderTable(document.getElementById('th-depositonly'), document.getElementById('tb-depositonly'), TOP_DEP);

  renderAllStars();
  renderWeeklyKPIs();
  renderLatest10();
}

// All-stars: intersection by account column
function getAccountKey(headers, row){
  const accHeader = headers.find(isAccountHeader);
  return String(accHeader ? row[accHeader] : Object.values(row)[0] ?? '').trim();
}

function renderAllStars(){
  const wrap = document.getElementById('allstars');
  wrap.innerHTML='';
  if (!TOP_AMOUNT.length || !TOP_FREQ.length || !TOP_DEP.length){ wrap.innerHTML='<div class="subtitle">ยังไม่พอสร้างการ์ดสรุป</div>'; return; }

  // Build sets of account keys
  const A = new Map(TOP_AMOUNT.map(r => [getAccountKey(H_AMOUNT, r), r]));
  const B = new Map(TOP_FREQ.map(r => [getAccountKey(H_FREQ, r), r]));
  const C = new Map(TOP_DEP.map(r => [getAccountKey(H_DEP, r), r]));

  const keysA = Array.from(A.keys());
  const intersection = keysA.filter(k => B.has(k) && C.has(k)).slice(0,3);

  if (!intersection.length){
    wrap.innerHTML = '<div class="subtitle">ยังไม่มีบัญชีที่อยู่ในทั้ง 3 เงื่อนไขพร้อมกัน</div>';
    return;
  }

  // derive useful headers (count & balance if exist)
  const balanceH = H_AMOUNT.find(isBalanceHeader) || H_FREQ.find(isBalanceHeader) || H_DEP.find(isBalanceHeader);
  const countH   = H_AMOUNT.find(isCountHeader)   || H_FREQ.find(isCountHeader)   || H_DEP.find(isCountHeader);

  intersection.forEach((key, i)=>{
    const rA = A.get(key) || {}; const rB = B.get(key) || {}; const rC = C.get(key) || {};
    const amountTxt = balanceH ? (isNumeric(rA[balanceH]||rB[balanceH]||rC[balanceH])? fmtNumber(rA[balanceH]||rB[balanceH]||rC[balanceH]) : '-') : '-';
    const countTxt  = countH   ? (isNumeric(rA[countH]||rB[countH]||rC[countH])?  fmtNumber(rA[countH]||rB[countH]||rC[countH]) : '-') : '-';

    const card = document.createElement('div'); card.className='star-card';
    card.innerHTML = `
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

// ---- Weekly KPIs & latest 10 ----
function parseThaiDate(s){
  // ex: "22/9/2568, 9:23:26"
  try{
    const [datePart, timePart='00:00:00'] = String(s).split(',').map(t=>t.trim());
    const [d,m,y] = datePart.split('/').map(x=>parseInt(x,10));
    const [hh,mm,ss] = timePart.split(':').map(x=>parseInt(x,10));
    const gy = (y>2400) ? y-543 : y; // convert B.E. to A.D.
    return new Date(gy, m-1, d, hh||0, mm||0, ss||0);
  }catch(e){ return null; }
}

function isThisWeek(date){
  if (!date) return false;
  const now = new Date();
  const start = new Date(now);
  // เริ่มสัปดาห์วันจันทร์
  const day = (now.getDay()+6)%7; // Monday=0
  start.setDate(now.getDate() - day);
  start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(start.getDate()+7);
  return date >= start && date < end;
}

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

  // Top class by activity count
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

function renderLatest10(){
  // Sort TX by date desc
  const rows = TX.map(r=>({ ...r, __d: parseThaiDate(r['วันที่']) })).filter(r=>r.__d).sort((a,b)=>b.__d - a.__d).slice(0,10);
  const headers = ['วันที่','บัญชี','รายการ','จำนวนเงิน','ชั้น'];
  const thead = document.getElementById('th-latest');
  const tbody = document.getElementById('tb-latest');
  thead.innerHTML=''; tbody.innerHTML='';

  headers.forEach(h=>{ const th=document.createElement('th'); th.textContent=h; thead.appendChild(th); });
  rows.forEach(r=>{
    const tr=document.createElement('tr');
    const cells = [
      r['วันที่']||'',
      formatAccountMasked(r['บัญชี']||''),
      r['รายการ']||'',
      fmtNumber(r['จำนวนเงิน']||''),
      r['ชั้น']||''
    ];
    cells.forEach(v=>{ const td=document.createElement('td'); td.textContent=String(v); tr.appendChild(td); });
    tbody.appendChild(tr);
  });
}

// LIFF helpers
async function ensureLogin(){
  try{ await liff.init({ liffId: LIFF_ID }); }catch(e){ /* นอก LINE ก็ได้ */ }
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

// Flex builders
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
      hero:{ type:'image', url:'https://raw.githubusercontent.com/infobwd/wdconnect/main/top10.png', size:'full', aspectRatio:'20:13', aspectMode:'cover',
             action:{ type:'uri', uri:`https://liff.line.me/${LIFF_ID}` } },
      body:{ type:'box', layout:'vertical', contents:[
        { type:'text', text:title, weight:'bold', size:'lg' },
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

function buildFlexAllStars(rows){
  const headers = ['เลขบัญชี','คุณสมบัติ'];
  const headerBox = { type:'box', layout:'horizontal', contents: headers.map(h=>({type:'text', text:h, size:'xs', weight:'bold', align:'center', flex:1})) };
  const dataRows = rows.map((r,i)=>({
    type:'box', layout:'horizontal', backgroundColor: i%2? '#FFFFFF':'#F5F6FA',
    contents: [
      { type:'text', text: cut(formatAccountMasked(r.key), 18), size:'xs', align:'center', flex:1 },
      { type:'text', text: 'ยอดสูง • ฝากถี่ • ไม่เคยถอน', size:'xs', align:'center', flex:1 }
    ]
  }));
  return {
    type:'flex', altText:'WDBank • 3 บัญชีเด่น',
    contents:{ type:'bubble', size:'giga',
      body:{ type:'box', layout:'vertical', contents:[
        { type:'text', text:'WDBank • 3 บัญชีเด่น', weight:'bold', size:'lg' },
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

// Share handlers
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
  const flex = buildFlexAllStars(inter);
  await liff.shareTargetPicker([flex]);
  liff.closeWindow && liff.closeWindow();
}

// ---- PDF (เหมือน v2) ----
function buildTxInsights(){
  if (!Array.isArray(TX) || TX.length===0) return { text: 'ไม่มีข้อมูลธุรกรรม', node: null };

  let depCount=0, wdrCount=0, depAmt=0, wdrAmt=0;
  const accSet = new Set();
  let minD=null, maxD=null;

  TX.forEach(r=>{
    const act = String(r['รายการ']||'').trim();
    const amt = toNumber(r['จำนวนเงิน']);
    const acc = String(r['บัญชี']||'').trim();
    const d = parseThaiDate(r['วันที่']);

    if (act === 'ฝาก'){ depCount++; depAmt += Number.isFinite(amt)? amt:0; }
    else if (act === 'ถอน'){ wdrCount++; wdrAmt += Number.isFinite(amt)? amt:0; }
    if (acc) accSet.add(acc);
    if (d){ if (!minD || d<minD) minD=d; if (!maxD || d>maxD) maxD=d; }
  });

  const net = depAmt - wdrAmt;
  const text = `ช่วงข้อมูล: ${minD? thaiDateString(minD):'-'} – ${maxD? thaiDateString(maxD):'-'}
  • จำนวนบัญชีที่มีรายการ: ${accSet.size.toLocaleString('th-TH')} บัญชี
  • ฝาก: ${depCount.toLocaleString('th-TH')} ครั้ง (รวม ${fmtNumber(depAmt)} บาท)
  • ถอน: ${wdrCount.toLocaleString('th-TH')} ครั้ง (รวม ${fmtNumber(wdrAmt)} บาท)
  • เงินไหลสุทธิ (ฝาก-ถอน): ${fmtNumber(net)} บาท`;

  const div=document.createElement('div');
  div.className='insight';
  div.innerHTML = `<strong>สารสนเทศผู้บริหาร</strong><br>${text.replace(/\\n/g,'<br>')}`;
  return { text, node: div };
}

function buildPDFSection(title, headers, rows){
  const wrap = document.createElement('div');

  const h1 = document.createElement('h1'); h1.textContent = title;
  wrap.appendChild(h1);

  const meta = document.createElement('div'); meta.className='meta'; meta.textContent = `WDBank • ออมก่อนใช้ • วันที่ ${thaiDateString()}`;
  wrap.appendChild(meta);

  // table
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
      td.textContent = text;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);

  const ins = buildTxInsights();
  if (ins.node) wrap.appendChild(ins.node);
  return wrap;
}

async function exportPDF(which){
  const report = document.getElementById('pdfReport');
  report.innerHTML='';

  let title='', headers=[], rows=[];
  if (which==='amount'){ title='รายงาน TOP 10 ยอดเงินสูง • ฝาก ≥ ค่าเฉลี่ย'; headers=headersOf(TOP_AMOUNT); rows=TOP_AMOUNT; }
  if (which==='frequent'){ title='รายงาน TOP 10 บัญชีฝากถี่มาก'; headers=headersOf(TOP_FREQ); rows=TOP_FREQ; }
  if (which==='depositonly'){ title='รายงาน TOP 10 ไม่เคยถอน • ฝาก ≥ ค่าเฉลี่ย'; headers=headersOf(TOP_DEP); rows=TOP_DEP; }

  if (!rows.length){ return alert('ไม่มีข้อมูลสำหรับรายงาน'); }
  const node = buildPDFSection(title, headers, rows);
  report.appendChild(node);

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

  pdf.save(`WDBank-${which}-${new Date().toISOString().slice(0,10)}.pdf`);
}

// Events
document.addEventListener('DOMContentLoaded', ()=>{
  loadAll();
  loadProfileAvatar();

  // share buttons
  document.getElementById('share-amount').addEventListener('click', shareAmount);
  document.getElementById('share-frequent').addEventListener('click', shareFrequent);
  document.getElementById('share-depositonly').addEventListener('click', shareDepositOnly);
  document.getElementById('share-allstars').addEventListener('click', shareAllStars);

  // pdf buttons
  document.getElementById('pdf-amount').addEventListener('click', ()=>exportPDF('amount'));
  document.getElementById('pdf-frequent').addEventListener('click', ()=>exportPDF('frequent'));
  document.getElementById('pdf-depositonly').addEventListener('click', ()=>exportPDF('depositonly'));

  // tabs
  document.querySelectorAll('.tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p=>p.classList.remove('show'));
      btn.classList.add('active');
      document.getElementById('panel-'+btn.dataset.tab).classList.add('show');
    });
  });
});
