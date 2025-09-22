
// Config (ใช้ LIFF ตัวเดียวสำหรับทั้งหน้า)
const LIFF_ID = '2005230346-2OVa774O';

// Sheet endpoints
const SHEET_AMOUNT    = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortบัญชีเงินมากและฝากมากกว่าหรือเท่ากับค่าเฉลี่ย';
const SHEET_FREQUENT  = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortบัญชีฝากถี่มาก';
const SHEET_DEPOSITONLY = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortบัญชีไม่ถอนและฝากมากกว่าหรือเท่ากับค่าเฉลี่ย';

let H_AMOUNT=[], H_FREQ=[], H_DEP=[];
let D_AMOUNT=[], D_FREQ=[], D_DEP=[];         // full datasets
let TOP_AMOUNT=[], TOP_FREQ=[], TOP_DEP=[];   // top10 per sheet

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

function isAccountHeader(h){ return /(เลข\s*บัญชี|บัญชี|account)/i.test(String(h)); }
function isCountHeader(h){ return /(จำนวน|ครั้ง|count)/i.test(String(h)); }
function isBalanceHeader(h){ return /(คงเหลือ|ยอดคงเหลือ|ยอด|รวม|amount|total|เงิน)/i.test(String(h)); }

function formatAccountDisplay(val){
  const raw = String(val ?? '').replace(/\s+/g, '');
  return raw.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
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
        const span=document.createElement('span'); span.className='star-acc'; span.textContent=formatAccountDisplay(raw);
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
  [D_AMOUNT, D_FREQ, D_DEP] = await Promise.all([fetchJSON(SHEET_AMOUNT), fetchJSON(SHEET_FREQUENT), fetchJSON(SHEET_DEPOSITONLY)]);
  H_AMOUNT=headersOf(D_AMOUNT); H_FREQ=headersOf(D_FREQ); H_DEP=headersOf(D_DEP);
  TOP_AMOUNT=D_AMOUNT.slice(0,10); TOP_FREQ=D_FREQ.slice(0,10); TOP_DEP=D_DEP.slice(0,10);

  renderTable(document.getElementById('th-amount'), document.getElementById('tb-amount'), TOP_AMOUNT);
  renderTable(document.getElementById('th-frequent'), document.getElementById('tb-frequent'), TOP_FREQ);
  renderTable(document.getElementById('th-depositonly'), document.getElementById('tb-depositonly'), TOP_DEP);

  renderAllStars();
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
          <div class="star-acc">${formatAccountDisplay(key)}</div>
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
    contents: headers.map(h=>({ type:'text', text: cut(isAccountHeader(h)? formatAccountDisplay(r[h]) : (isNumeric(r[h])? fmtNumber(r[h]): (r[h] ?? '')), 16), size:'xs', align:'center', flex:1 }))
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
      { type:'text', text: cut(formatAccountDisplay(r.key), 18), size:'xs', align:'center', flex:1 },
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
  // compute intersection again for safety
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

// Events
document.addEventListener('DOMContentLoaded', ()=>{
  loadAll();
  loadProfileAvatar();

  document.getElementById('share-amount').addEventListener('click', shareAmount);
  document.getElementById('share-frequent').addEventListener('click', shareFrequent);
  document.getElementById('share-depositonly').addEventListener('click', shareDepositOnly);
  document.getElementById('share-allstars').addEventListener('click', shareAllStars);

  document.querySelectorAll('.tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p=>p.classList.remove('show'));
      btn.classList.add('active');
      document.getElementById('panel-'+btn.dataset.tab).classList.add('show');
    });
  });
});
