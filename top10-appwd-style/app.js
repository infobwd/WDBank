// =================== Config ===================
const LIFF_ID = '2005230346-2OVa774O'; // TODO: แก้เป็น LIFF จริงของพี่

const SHEET_AMOUNT      = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortบัญชีเงินมากและฝากมากกว่าหรือเท่ากับค่าเฉลี่ย';
const SHEET_FREQUENT    = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortบัญชีฝากถี่มาก';
const SHEET_DEPOSITONLY = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortบัญชีไม่ถอนและฝากมากกว่าหรือเท่ากับค่าเฉลี่ย';
const SHEET_TX          = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortรายการฝากและถอน';
const SHEET_ACCOUNTS    = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo//บัญชี';

// =================== Supabase Bootstrap ===================
let supabase = null, BOOT_URL=null, BOOT_KEY=null;
const LS_URL='wdbank.supa_url', LS_KEY='wdbank.supa_key';
const SETTINGS_KEYS = ['school_name','semester','policy_text','supabase_url','supabase_anon_key'];

function readMeta(name){ const el=document.querySelector(`meta[name="${name}"]`); return el?.content||null; }
async function promptForBoot(){
  const { value: formValues } = await Swal.fire({
    title:'ใส่ค่า Supabase (ครั้งแรกเท่านั้น)',
    html:'<input id="sw-url" class="swal2-input" placeholder="Supabase URL (https://xxx.supabase.co)"><input id="sw-key" class="swal2-input" placeholder="Anon Key">',
    focusConfirm:false, confirmButtonText:'บันทึก',
    preConfirm:()=>{
      const url=document.getElementById('sw-url').value.trim();
      const key=document.getElementById('sw-key').value.trim();
      if(!url||!key){ Swal.showValidationMessage('กรุณากรอกให้ครบ'); return false;}
      return {url,key};
    }
  });
  if(formValues){
    localStorage.setItem(LS_URL, formValues.url);
    localStorage.setItem(LS_KEY, formValues.key);
    return formValues;
  }
  throw new Error('User cancelled bootstrap');
}
async function resolveBootCreds(){
  let url=readMeta('supabase-url')||localStorage.getItem(LS_URL);
  let key=readMeta('supabase-anon-key')||localStorage.getItem(LS_KEY);
  if(!url||!key){ const v=await promptForBoot(); url=v.url; key=v.key; }
  BOOT_URL=url; BOOT_KEY=key; return {url,key};
}
function initClient(url,key){ supabase = window.supabase.createClient(url,key); return supabase; }
async function fetchSettingsFromDB(){ const {data,error} = await supabase.from('settings').select('key,value').in('key', SETTINGS_KEYS); if(error) throw error; const map={}; (data||[]).forEach(r=>map[r.key]=r.value); return map; }
async function initSupabaseFinal(){
  if(!supabase){ const {url,key}=await resolveBootCreds(); initClient(url,key); }
  let settings={};
  try{ settings = await fetchSettingsFromDB(); }catch(e){ console.warn('อ่าน settings ไม่ได้:', e); return {settings, supabase}; }
  const dbUrl=settings['supabase_url'], dbKey=settings['supabase_anon_key'];
  if(dbUrl && dbKey && (dbUrl!==BOOT_URL || dbKey!==BOOT_KEY)){ BOOT_URL=dbUrl; BOOT_KEY=dbKey; initClient(BOOT_URL, BOOT_KEY); }
  return { settings, supabase };
}

// =================== State & Utils ===================
let H_AMOUNT=[], H_FREQ=[], H_DEP=[];
let D_AMOUNT=[], D_FREQ=[], D_DEP=[];
let TOP_AMOUNT=[], TOP_FREQ=[], TOP_DEP=[];
let TX=[], AC=[];

let CURRENT_SETTINGS={};

const isNumeric=(val)=>{ if(val===null||val===undefined) return false; const n=Number(String(val).replace(/[, ]/g,'')); return Number.isFinite(n); };
const toNumber=(val)=> Number(String(val).replace(/[, ]/g,''));
const fmtNumber=(val)=>{ const n=Number(String(val).replace(/[, ]/g,'')); return Number.isFinite(n)? n.toLocaleString('th-TH', { maximumFractionDigits:2 }) : String(val??''); };
const cut=(s,len)=> String(s??'').length>len? String(s).slice(0,len-1)+'…' : String(s??'');
const thaiDateString=(d=new Date())=> d.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
function isAccountHeader(h){ return /(เลข\\s*บัญชี|บัญชี|account|รหัสนักเรียน)/i.test(String(h)); }
function isCountHeader(h){ return /(จำนวน|ครั้ง|count)/i.test(String(h)); }
function isBalanceHeader(h){ return /(คงเหลือ|ยอดคงเหลือ|ยอด|รวม|amount|total|เงิน)/i.test(String(h)); }
function isClassHeader(h){ return /(ชั้น|ห้อง|class)/i.test(String(h)); }
function formatAccountMasked(val){
  const raw=String(val??'').replace(/\\s+/g,'').replace(/,/g,'');
  if(!raw) return '-';
  const first=raw.slice(0,4);
  const last2=raw.slice(-2);
  return `${first} •••• ••${last2}`.trim();
}
function headersOf(rows){ return Object.keys(rows?.[0]||{}); }
function clearSkeleton(){ document.querySelectorAll('.sk').forEach(el=>el.classList.remove('sk')); }

// =================== Rendering ===================
function renderTable(headEl, bodyEl, rows){
  headEl.innerHTML=''; bodyEl.innerHTML='';
  if(!rows?.length){ headEl.innerHTML='<th>ข้อมูล</th>'; bodyEl.innerHTML='<tr><td>ไม่พบข้อมูล</td></tr>'; return; }
  const headers = headersOf(rows);
  headers.forEach(h=>{ const th=document.createElement('th'); th.textContent=h; headEl.appendChild(th); });
  rows.forEach(r=>{
    const tr=document.createElement('tr');
    headers.forEach(h=>{
      const td=document.createElement('td');
      const raw=r[h];
      if(isAccountHeader(h)){ const span=document.createElement('span'); span.className='acc-pill'; span.textContent=formatAccountMasked(raw); td.appendChild(span); }
      else if(isNumeric(raw)){ td.textContent=fmtNumber(raw); }
      else { td.textContent=String(raw??''); }
      tr.appendChild(td);
    });
    bodyEl.appendChild(tr);
  });
}

function getAccountKey(headers, row){
  const accHeader=headers.find(isAccountHeader);
  return String(accHeader? row[accHeader] : Object.values(row)[0]??'').trim();
}

function renderAllStars(){
  const wrap=document.getElementById('allstars'); wrap.innerHTML='';
  if(!TOP_AMOUNT.length || !TOP_FREQ.length || !TOP_DEP.length){
    wrap.innerHTML='<div class="subtitle">ยังไม่พอสร้างการ์ดสรุป</div>'; return;
  }
  const A=new Map(TOP_AMOUNT.map(r=>[getAccountKey(headersOf(TOP_AMOUNT),r),r]));
  const B=new Map(TOP_FREQ.map(r=>[getAccountKey(headersOf(TOP_FREQ),r),r]));
  const C=new Map(TOP_DEP.map(r=>[getAccountKey(headersOf(TOP_DEP),r),r]));
  const keysA=Array.from(A.keys());
  const intersection=keysA.filter(k=>B.has(k)&&C.has(k)).slice(0,3);

  const balanceH=headersOf(TOP_AMOUNT).find(isBalanceHeader)||headersOf(TOP_FREQ).find(isBalanceHeader)||headersOf(TOP_DEP).find(isBalanceHeader);
  const countH=headersOf(TOP_AMOUNT).find(isCountHeader)||headersOf(TOP_FREQ).find(isCountHeader)||headersOf(TOP_DEP).find(isCountHeader);
  const classH=headersOf(TOP_AMOUNT).find(isClassHeader)||headersOf(TOP_FREQ).find(isClassHeader)||headersOf(TOP_DEP).find(isClassHeader);

  intersection.forEach(key=>{
    const rA=A.get(key)||{}, rB=B.get(key)||{}, rC=C.get(key)||{};
    const cls=(classH&&(rA[classH]||rB[classH]||rC[classH]))? String(rA[classH]||rB[classH]||rC[classH]):'ไม่ระบุ';
    const amountTxt=balanceH?(isNumeric(rA[balanceH]||rB[balanceH]||rC[balanceH])? fmtNumber(rA[balanceH]||rB[balanceH]||rC[balanceH]) : '-'):'-';
    const countTxt=countH?(isNumeric(rA[countH]||rB[countH]||rC[countH])? fmtNumber(rA[countH]||rB[countH]||rC[countH]) : '-'):'-';

    const card=document.createElement('div'); card.className='star-card';
    card.innerHTML=`
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
      <div class="class-tag"><i class="fa-solid fa-school"></i> ${cls}</div>
    `;
    wrap.appendChild(card);
  });
}

function parseThaiDate(s){
  try{
    const [datePart,timePart='00:00:00']=String(s).split(',').map(t=>t.trim());
    const [d,m,y]=datePart.split('/').map(x=>parseInt(x,10));
    const [hh,mm,ss]=timePart.split(':').map(x=>parseInt(x,10));
    const gy=(y>2400)? y-543:y;
    return new Date(gy,m-1,d,hh||0,mm||0,ss||0);
  }catch(e){return null;}
}
function isThisWeek(date){
  if(!date) return false; const now=new Date();
  const start=new Date(now); const day=(now.getDay()+6)%7;
  start.setDate(now.getDate()-day); start.setHours(0,0,0,0);
  const end=new Date(start); end.setDate(start.getDate()+7);
  return date>=start && date<end;
}
function renderLatest10(){
  const rows=TX.map(r=>({...r,__d:parseThaiDate(r['วันที่'])})).filter(r=>r.__d).sort((a,b)=>b.__d-a.__d).slice(0,10);
  const headers=['วันที่','บัญชี','รายการ','จำนวนเงิน','ชั้น'];
  const thead=document.getElementById('th-latest'); const tbody=document.getElementById('tb-latest'); thead.innerHTML=''; tbody.innerHTML='';
  headers.forEach(h=>{ const th=document.createElement('th'); th.textContent=h; thead.appendChild(th); });
  rows.forEach(r=>{
    const tr=document.createElement('tr');
    const act=String(r['รายการ']||''); const badge=`<span class="badge-act ${act==='ฝาก'?'badge-dep':'badge-wdr'}"><i class="fa-solid ${act==='ฝาก'?'fa-arrow-down':'fa-arrow-up'}"></i> ${act}</span>`;
    const cells=[ r['วันที่']||'', formatAccountMasked(r['บัญชี']||''), '', fmtNumber(r['จำนวนเงิน']||''), r['ชั้น']||r['ห้อง']||'' ];
    cells.forEach((v,i)=>{ const td=document.createElement('td'); if(i===2){ td.innerHTML=badge; } else { td.textContent=String(v);} tr.appendChild(td); });
    tbody.appendChild(tr);
  });
}

// =================== Data ===================
async function fetchJSON(url,{timeout=12000,retries=2}={}){
  const attempt=async()=>{
    const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(), timeout);
    try{
      const res=await fetch(url+(url.includes('?')?'&':'?')+'_ts='+Date.now(),{signal:ctrl.signal,cache:'no-store'});
      clearTimeout(t); if(!res.ok) throw new Error('HTTP '+res.status);
      return await res.json();
    }catch(e){ clearTimeout(t); throw e; }
  };
  for(let i=0;i<=retries;i++){
    try{ return await attempt(); }
    catch(err){ if(i===retries) throw err; await new Promise(r=>setTimeout(r, 600*(i+1))); }
  }
}
async function loadAll(){
  document.getElementById('todayThai').textContent=thaiDateString();
  try{
    const [A,B,C,T,X] = await Promise.allSettled([
      fetchJSON(SHEET_AMOUNT), fetchJSON(SHEET_FREQUENT), fetchJSON(SHEET_DEPOSITONLY),
      fetchJSON(SHEET_TX), fetchJSON(SHEET_ACCOUNTS)
    ]);
    if(A.status==='fulfilled') D_AMOUNT=A.value; if(B.status==='fulfilled') D_FREQ=B.value; if(C.status==='fulfilled') D_DEP=C.value;
    if(T.status==='fulfilled') TX=T.value; if(X.status==='fulfilled') AC=X.value;
  }catch(e){
    console.error('โหลดข้อมูลล้มเหลว', e);
    Swal.fire('เกิดข้อผิดพลาด','มีปัญหาในการโหลดข้อมูลบางส่วน โปรดลองใหม่อีกครั้ง','error');
  }
  H_AMOUNT=headersOf(D_AMOUNT); H_FREQ=headersOf(D_FREQ); H_DEP=headersOf(D_DEP);
  TOP_AMOUNT=D_AMOUNT.slice(0,10); TOP_FREQ=D_FREQ.slice(0,10); TOP_DEP=D_DEP.slice(0,10);
  renderTable(document.getElementById('th-amount'),document.getElementById('tb-amount'),TOP_AMOUNT);
  renderTable(document.getElementById('th-frequent'),document.getElementById('tb-frequent'),TOP_FREQ);
  renderTable(document.getElementById('th-depositonly'),document.getElementById('tb-depositonly'),TOP_DEP);
  renderAllStars(); renderWeeklyKPIs(); renderLatest10(); clearSkeleton();
}

// =================== KPIs ===================
function renderWeeklyKPIs(){
  let depCount=0,wdrCount=0,depAmt=0,wdrAmt=0; const classCount=new Map();
  TX.forEach(r=>{
    const d=parseThaiDate(r['วันที่']); if(!isThisWeek(d)) return;
    const act=String(r['รายการ']||'').trim(); const amt=toNumber(r['จำนวนเงิน']);
    const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ');
    if(act==='ฝาก'){ depCount++; depAmt+=Number.isFinite(amt)?amt:0; }
    else if(act==='ถอน'){ wdrCount++; wdrAmt+=Number.isFinite(amt)?amt:0; }
    classCount.set(cls,(classCount.get(cls)||0)+1);
  });
  let topClass='-',topClassCount=0;
  for(const [k,v] of classCount.entries()){ if(v>topClassCount){ topClass=k; topClassCount=v; } }
  document.getElementById('kpiDepCount').textContent=depCount.toLocaleString('th-TH')+' ครั้ง';
  document.getElementById('kpiDepAmt').textContent='รวม '+fmtNumber(depAmt)+' บาท';
  document.getElementById('kpiWdrCount').textContent=wdrCount.toLocaleString('th-TH')+' ครั้ง';
  document.getElementById('kpiWdrAmt').textContent='รวม '+fmtNumber(wdrAmt)+' บาท';
  document.getElementById('kpiNet').textContent=fmtNumber(depAmt-wdrAmt)+' บาท';
  document.getElementById('kpiTopClass').textContent=topClass;
  document.getElementById('kpiTopClassDetail').textContent=topClass==='-'?'-':(topClassCount.toLocaleString('th-TH')+' ครั้งสัปดาห์นี้');
}

// =================== LIFF ===================
async function ensureLogin(){
  try{ await liff.init({liffId:LIFF_ID}); }catch(e){}
  if(!liff.isLoggedIn()){
    await Swal.fire({title:'ต้องเข้าสู่ระบบ LINE',text:'เพื่อแชร์ผ่าน LINE จำเป็นต้องเข้าสู่ระบบก่อน',icon:'info',confirmButtonText:'เข้าสู่ระบบ'});
    liff.login({redirectUri:location.href});
    throw new Error('login-redirect');
  }
}
async function loadProfileAvatar(){
  try{
    await liff.init({liffId:LIFF_ID});
    if(liff.isLoggedIn()){
      const p=await liff.getProfile();
      if(p?.pictureUrl) document.getElementById('avatar').src=p.pictureUrl;
      document.getElementById('loginBadge').classList.remove('show');
    } else {
      document.getElementById('loginBadge').classList.add('show');
    }
  }catch(e){
    document.getElementById('loginBadge').classList.add('show');
  }
}

// =================== Flex Share with LIFF button ===================
function flexWithOpenButton(bubble){
  const uri=`https://liff.line.me/${LIFF_ID}`;
  const footer={type:'box',layout:'vertical',spacing:'sm',contents:[{type:'button',style:'primary',action:{type:'uri',label:'เปิด WDBank (LIFF)',uri}}]};
  bubble.footer=footer; return bubble;
}
function buildFlexFromRows(title,rows){
  if(!rows?.length) return null;
  const headers=Object.keys(rows[0]);
  const headerBox={type:'box',layout:'horizontal',contents:headers.map(h=>({type:'text',text:cut(h,12),size:'xs',weight:'bold',align:'center',flex:1}))};
  const dataRows=rows.map((r,i)=>({
    type:'box',layout:'horizontal',backgroundColor:i%2?'#FFFFFF':'#F5F6FA',
    contents:headers.map(h=>({type:'text',text:cut((isAccountHeader(h)? formatAccountMasked(r[h]) : (isNumeric(r[h])? fmtNumber(r[h]): (r[h]??''))),16),size:'xs',align:'center',flex:1}))
  }));
  const bubble={type:'bubble',size:'giga',body:{type:'box',layout:'vertical',contents:[
    {type:'text',text:title,weight:'bold',size:'lg'},
    {type:'text',text:`ออมก่อนใช้ • ${thaiDateString()}`,color:'#7286D3',size:'sm'},
    {type:'separator',margin:'md'}, headerBox,
    {type:'separator',margin:'sm'},
    {type:'box',layout:'vertical',margin:'md',spacing:'sm',contents:dataRows}
  ]}};
  return {type:'flex',altText:title,contents:flexWithOpenButton(bubble)};
}
async function shareAmount(){ await ensureLogin(); const flex=buildFlexFromRows('WDBank • TOP 10 ยอดเงินสูง', TOP_AMOUNT); await liff.shareTargetPicker([flex]); liff.closeWindow&&liff.closeWindow(); }
async function shareFrequent(){ await ensureLogin(); const flex=buildFlexFromRows('WDBank • TOP 10 ฝากถี่มาก', TOP_FREQ); await liff.shareTargetPicker([flex]); liff.closeWindow&&liff.closeWindow(); }
async function shareDepositOnly(){ await ensureLogin(); const flex=buildFlexFromRows('WDBank • TOP 10 ไม่เคยถอน (ฝาก ≥ ค่าเฉลี่ย)', TOP_DEP); await liff.shareTargetPicker([flex]); liff.closeWindow&&liff.closeWindow(); }
async function shareAllStars(){
  await ensureLogin();
  const A=new Set(TOP_AMOUNT.map(r=>String(Object.values(r)[0])));
  const B=new Set(TOP_FREQ.map(r=>String(Object.values(r)[0])));
  const C=new Set(TOP_DEP.map(r=>String(Object.values(r)[0])));
  const inter=[...A].filter(k=>B.has(k)&&C.has(k)).slice(0,3).map(k=>({key:k}));
  const headers=['เลขบัญชี','คุณสมบัติ'];
  const headerBox={type:'box',layout:'horizontal',contents:headers.map(h=>({type:'text',text:h,size:'xs',weight:'bold',align:'center',flex:1}))};
  const dataRows=inter.map((r,i)=>({
    type:'box',layout:'horizontal',backgroundColor:i%2?'#FFFFFF':'#F5F6FA',
    contents:[
      {type:'text',text:cut(formatAccountMasked(r.key),18),size:'xs',align:'center',flex:1},
      {type:'text',text:'ยอดสูง • ฝากถี่ • ไม่เคยถอน',size:'xs',align:'center',flex:1}
    ]
  }));
  const bubble={type:'bubble',size:'giga',body:{type:'box',layout:'vertical',contents:[
    {type:'text',text:'WDBank • 3 บัญชีเด่น',weight:'bold',size:'lg'},
    {type:'text',text:`ออมก่อนใช้ • ${thaiDateString()}`,color:'#7286D3',size:'sm'},
    {type:'separator',margin:'md'}, headerBox,
    {type:'separator',margin:'sm'},
    {type:'box',layout:'vertical',margin:'md',spacing:'sm',contents:dataRows}
  ]}};
  const flex={type:'flex',altText:'WDBank • 3 บัญชีเด่น',contents:flexWithOpenButton(bubble)};
  await liff.shareTargetPicker([flex]); liff.closeWindow&&liff.closeWindow();
}

// =================== PDF (with School Name) ===================
async function ensureSettings(){
  if (!CURRENT_SETTINGS || !Object.keys(CURRENT_SETTINGS).length) {
    try { const { settings } = await initSupabaseFinal(); CURRENT_SETTINGS = settings || {}; } catch(e) {}
  }
}
function buildPDFShell(title){
  const school = (CURRENT_SETTINGS && CURRENT_SETTINGS['school_name']) ? CURRENT_SETTINGS['school_name'] : 'โรงเรียนของเรา';
  const wrap=document.createElement('div');
  const header=document.createElement('div'); header.className='header';
  const img=document.createElement('img'); img.src='./assets/crest.svg'; img.alt=school;
  const headBox=document.createElement('div');
  const h1=document.createElement('h1'); h1.textContent=title;
  const h2=document.createElement('div'); h2.style.fontSize='14px'; h2.style.color='#334155'; h2.style.fontWeight='700'; h2.textContent=school;
  headBox.appendChild(h1); headBox.appendChild(h2);
  header.appendChild(img); header.appendChild(headBox);
  wrap.appendChild(header);
  const meta=document.createElement('div'); meta.className='meta'; meta.textContent = `${school} • ออมก่อนใช้ • วันที่ ${thaiDateString()}`;
  wrap.appendChild(meta);
  return wrap;
}
async function renderPDF(node, filename){
  const report=document.getElementById('pdfReport'); report.innerHTML=''; report.appendChild(node);
  const canvas=await html2canvas(report,{scale:2, backgroundColor:'#ffffff'});
  const imgData=canvas.toDataURL('image/png'); const { jsPDF }=window.jspdf; const pdf=new jsPDF({orientation:'p', unit:'pt', format:'a4'});
  const pageWidth=pdf.internal.pageSize.getWidth(), pageHeight=pdf.internal.pageSize.getHeight(), margin=24;
  const imgWidth=pageWidth - margin*2; const imgHeight = canvas.height * imgWidth / canvas.width;
  if(imgHeight <= pageHeight - margin*2){ pdf.addImage(imgData,'PNG',margin,margin,imgWidth,imgHeight); }
  else{
    let sH=0; const pageCanvas=document.createElement('canvas'); const ctx=pageCanvas.getContext('2d'); const ratio=imgWidth/canvas.width; const sliceHeightPx=(pageHeight - margin*2)/ratio;
    while(sH<canvas.height){
      const slice=Math.min(sliceHeightPx, canvas.height - sH); pageCanvas.width=canvas.width; pageCanvas.height=slice;
      ctx.drawImage(canvas,0,sH,canvas.width,slice,0,0,canvas.width,slice);
      const sliceData=pageCanvas.toDataURL('image/png'); const sliceHpt=slice*ratio;
      pdf.addImage(sliceData,'PNG',margin,margin,imgWidth,sliceHpt);
      sH+=slice; if(sH<canvas.height) pdf.addPage();
    }
  }
  pdf.save(filename);
}
function buildPDFTable(headers, rows){
  const table=document.createElement('table'); const thead=document.createElement('thead'); const trh=document.createElement('tr');
  headers.forEach(h=>{ const th=document.createElement('th'); th.textContent=h; trh.appendChild(th); }); thead.appendChild(trh); table.appendChild(thead);
  const tbody=document.createElement('tbody');
  rows.forEach(r=>{
    const tr=document.createElement('tr'); headers.forEach(h=>{
      const td=document.createElement('td'); const v=r[h];
      const text=isAccountHeader(h)? formatAccountMasked(v) : (isNumeric(v)? fmtNumber(v): String(v??''));
      td.textContent=text; tr.appendChild(td);
    }); tbody.appendChild(tr);
  });
  table.appendChild(tbody); return table;
}
async function exportPDF(which){
  await ensureSettings();
  let title='', headers=[], rows=[];
  if(which==='amount'){ title='รายงาน TOP 10 ยอดเงินสูง • ฝาก ≥ ค่าเฉลี่ย'; headers=headersOf(TOP_AMOUNT); rows=TOP_AMOUNT; }
  if(which==='frequent'){ title='รายงาน TOP 10 บัญชีฝากถี่มาก'; headers=headersOf(TOP_FREQ); rows=TOP_FREQ; }
  if(which==='depositonly'){ title='รายงาน TOP 10 ไม่เคยถอน • ฝาก ≥ ค่าเฉลี่ย'; headers=headersOf(TOP_DEP); rows=TOP_DEP; }
  if(!rows.length){ return alert('ไม่มีข้อมูลสำหรับรายงาน'); }
  const wrap=buildPDFShell(title); wrap.appendChild(buildPDFTable(headers, rows));
  addSignatureBlock(wrap); await renderPDF(wrap, `WDBank-${which}-${new Date().toISOString().slice(0,10)}.pdf`);
}
function addSignatureBlock(wrap){
  const row=document.createElement('div'); row.className='sign-row';
  const left=document.createElement('div'); left.className='sign'; left.innerHTML='<div class="line"></div><div>ผู้บริหารสถานศึกษา (ลงชื่อ)</div>';
  const right=document.createElement('div'); right.className='sign'; right.innerHTML='<div class="line"></div><div>ผู้รับผิดชอบงานธนาคารโรงเรียน (ลงชื่อ)</div>';
  row.appendChild(left); row.appendChild(right); wrap.appendChild(row);
}
function parseDateRangeFilter(kind){
  const now=new Date(); let start,end;
  if(kind==='week'){
    start=new Date(now); const day=(now.getDay()+6)%7; start.setDate(now.getDate()-day); start.setHours(0,0,0,0);
    end=new Date(start); end.setDate(start.getDate()+7);
  } else if(kind==='month'){
    start=new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0);
    end=new Date(now.getFullYear(), now.getMonth()+1, 1, 0,0,0,0);
  }
  return {start,end};
}
function inRange(d,start,end){ return d && d>=start && d<end; }
function buildTxInsightsRange(start,end){
  let depCount=0,wdrCount=0,depAmt=0,wdrAmt=0; const classCount=new Map();
  TX.forEach(r=>{
    const d=parseThaiDate(r['วันที่']); if(!inRange(d,start,end)) return;
    const act=String(r['รายการ']||'').trim(); const amt=toNumber(r['จำนวนเงิน']); const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ');
    if(act==='ฝาก'){ depCount++; depAmt+=Number.isFinite(amt)?amt:0; } else if(act==='ถอน'){ wdrCount++; wdrAmt+=Number.isFinite(amt)?amt:0; }
    classCount.set(cls,(classCount.get(cls)||0)+1);
  });
  let topClass='-',topClassCount=0;
  for(const [k,v] of classCount.entries()){ if(v>topClassCount){ topClass=k; topClassCount=v; } }
  const net=depAmt-wdrAmt;
  const text=`ช่วงข้อมูล: ${thaiDateString(start)} – ${thaiDateString(end)}
• ฝาก: ${depCount.toLocaleString('th-TH')} ครั้ง (รวม ${fmtNumber(depAmt)} บาท)
• ถอน: ${wdrCount.toLocaleString('th-TH')} ครั้ง (รวม ${fmtNumber(wdrAmt)} บาท)
• เงินไหลสุทธิ (ฝาก-ถอน): ${fmtNumber(net)} บาท
• ชั้นที่เคลื่อนไหวสูงสุด: ${topClass} (${topClassCount.toLocaleString('th-TH')} ครั้ง)`;
  const div=document.createElement('div'); div.className='insight'; div.innerHTML=`<strong>สรุปช่วงเวลา</strong><br>${text.replace(/\\n/g,'<br>')}`; return {node:div};
}
async function exportSummaryPDF(kind){
  await ensureSettings();
  const {start,end}=parseDateRangeFilter(kind);
  const wrap=buildPDFShell(kind==='week'?'สรุปรายสัปดาห์':'สรุปรายเดือน');
  const insight=buildTxInsightsRange(start,end); if(insight.node) wrap.appendChild(insight.node);
  const classAgg=new Map();
  TX.forEach(r=>{
    const d=parseThaiDate(r['วันที่']); if(!inRange(d,start,end)) return;
    const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ');
    const act=String(r['รายการ']||'').trim();
    const amt=toNumber(r['จำนวนเงิน']);
    const obj=classAgg.get(cls)||{ฝาก:0,ถอน:0,ครั้งฝาก:0,ครั้งถอน:0};
    if(act==='ฝาก'){ obj.ฝาก+=Number.isFinite(amt)?amt:0; obj.ครั้งฝาก++; }
    else if(act==='ถอน'){ obj.ถอน+=Number.isFinite(amt)?amt:0; obj.ครั้งถอน++; }
    classAgg.set(cls,obj);
  });
  const table=document.createElement('table'); const thead=document.createElement('thead'); thead.innerHTML='<tr><th>ชั้น</th><th>ครั้งฝาก</th><th>ครั้งถอน</th><th>รวมฝาก</th><th>รวมถอน</th><th>สุทธิ</th></tr>'; const tbody=document.createElement('tbody');
  for(const [cls,v] of classAgg.entries()){
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${cls}</td><td>${fmtNumber(v.ครั้งฝาก)}</td><td>${fmtNumber(v.ครั้งถอน)}</td><td>${fmtNumber(v.ฝาก)}</td><td>${fmtNumber(v.ถอน)}</td><td>${fmtNumber(v.ฝาก - v.ถอน)}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(thead); table.appendChild(tbody); wrap.appendChild(table);
  addSignatureBlock(wrap); await renderPDF(wrap, `WDBank-summary-${kind}-${new Date().toISOString().slice(0,10)}.pdf`);
}
function buildClassBalanceSummary(){
  const rows=Array.isArray(AC)? AC:[]; const result=new Map();
  rows.forEach(r=>{
    const cls=String(r['ห้อง']||r['ชั้น']||'ไม่ระบุ');
    const dep=toNumber(r['ฝาก']); const wdr=toNumber(r['ถอน']); const bal=toNumber(r['จำนวนเงินคงเหลือ']);
    const depC=toNumber(r['จำนวนครั้งที่ฝาก']); const wdrC=toNumber(r['จำนวนครั้งที่ถอน']);
    const obj=result.get(cls)||{ฝาก:0,ถอน:0,คงเหลือ:0,ครั้งฝาก:0,ครั้งถอน:0,บัญชี:0};
    obj.ฝาก+=Number.isFinite(dep)?dep:0; obj.ถอน+=Number.isFinite(wdr)?wdr:0; obj.คงเหลือ+=Number.isFinite(bal)?bal:0;
    obj.ครั้งฝาก+=Number.isFinite(depC)?depC:0; obj.ครั้งถอน+=Number.isFinite(wdrC)?wdrC:0; obj.บัญชี+=1;
    result.set(cls,obj);
  });
  const table=document.createElement('table'); const thead=document.createElement('thead');
  thead.innerHTML='<tr><th>ชั้น</th><th>จำนวนบัญชี</th><th>รวมฝาก</th><th>รวมถอน</th><th>คงเหลือรวม</th><th>ครั้งฝาก</th><th>ครั้งถอน</th></tr>';
  const tbody=document.createElement('tbody');
  for(const [cls,v] of result.entries()){
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${cls}</td><td>${fmtNumber(v.บัญชี)}</td><td>${fmtNumber(v.ฝาก)}</td><td>${fmtNumber(v.ถอน)}</td><td>${fmtNumber(v.คงเหลือ)}</td><td>${fmtNumber(v.ครั้งฝาก)}</td><td>${fmtNumber(v.ครั้งถอน)}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(thead); table.appendChild(tbody); return table;
}
async function exportClassBalancePDF(){
  await ensureSettings();
  const wrap=buildPDFShell('ยอดคงเหลือรวมรายชั้น'); wrap.appendChild(buildClassBalanceSummary());
  addSignatureBlock(wrap); await renderPDF(wrap, `WDBank-class-balance-${new Date().toISOString().slice(0,10)}.pdf`);
}
async function exportSavingsPDF(){
  await ensureSettings();
  const rows=Array.isArray(AC)? AC:[];
  const filtered=rows.filter(r=>String(r['ออมสิน']||'').toUpperCase()==='TRUE');
  if(!filtered.length){ return alert('ไม่มีบัญชีที่เป็นออมสิน (TRUE)'); }
  const wrap=buildPDFShell('บัญชีสำหรับนำฝากต่อธนาคารออมสิน');
  let sumBal=0,sumDep=0,sumWdr=0,count=filtered.length;
  filtered.forEach(r=>{
    sumBal+=Number.isFinite(toNumber(r['จำนวนเงินคงเหลือ']))?toNumber(r['จำนวนเงินคงเหลือ']):0;
    sumDep+=Number.isFinite(toNumber(r['ฝาก']))?toNumber(r['ฝาก']):0;
    sumWdr+=Number.isFinite(toNumber(r['ถอน']))?toNumber(r['ถอน']):0;
  });
  const info=document.createElement('div');
  info.className='insight';
  info.innerHTML=`<strong>สรุป</strong><br>จำนวนนำส่ง: ${fmtNumber(count)} บัญชี<br>รวมฝาก: ${fmtNumber(sumDep)} บาท • รวมถอน: ${fmtNumber(sumWdr)} บาท<br>คงเหลือรวม: ${fmtNumber(sumBal)} บาท`;
  wrap.appendChild(info);
  const headers=['บัญชี','ห้อง','ฝาก','ถอน','จำนวนเงินคงเหลือ','สถานะบัญชี'];
  const rowsOut=filtered.map(r=>({
    'บัญชี':formatAccountMasked(r['รหัสนักเรียน']||r['บัญชี']||''),
    'ห้อง':r['ห้อง']||r['ชั้น']||'',
    'ฝาก':fmtNumber(r['ฝาก']),
    'ถอน':fmtNumber(r['ถอน']),
    'จำนวนเงินคงเหลือ':fmtNumber(r['จำนวนเงินคงเหลือ']),
    'สถานะบัญชี':r['สถานะบัญชี']||''
  }));
  wrap.appendChild(buildPDFTable(headers, rowsOut));
  addSignatureBlock(wrap); await renderPDF(wrap, `WDBank-savings-gsb-${new Date().toISOString().slice(0,10)}.pdf`);
}

// =================== Events ===================
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('todayThai').textContent=thaiDateString();
  loadAll();
  loadProfileAvatar();

  document.querySelectorAll('.tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p=>p.classList.remove('show'));
      btn.classList.add('active');
      document.getElementById('panel-'+btn.dataset.tab).classList.add('show');
    });
  });

  document.getElementById('share-amount').addEventListener('click', shareAmount);
  document.getElementById('share-frequent').addEventListener('click', shareFrequent);
  document.getElementById('share-depositonly').addEventListener('click', shareDepositOnly);
  document.getElementById('share-allstars').addEventListener('click', shareAllStars);

  document.getElementById('pdf-amount').addEventListener('click', ()=>exportPDF('amount'));
  document.getElementById('pdf-frequent').addEventListener('click', ()=>exportPDF('frequent'));
  document.getElementById('pdf-depositonly').addEventListener('click', ()=>exportPDF('depositonly'));
  document.getElementById('pdf-week').addEventListener('click', ()=>exportSummaryPDF('week'));
  document.getElementById('pdf-month').addEventListener('click', ()=>exportSummaryPDF('month'));
  document.getElementById('pdf-classsum').addEventListener('click', exportClassBalancePDF);
  document.getElementById('pdf-savings').addEventListener('click', exportSavingsPDF);
});

console.log('WDBank v6.2 loaded');
