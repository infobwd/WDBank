// Minimal app for the requested features (v6.4.3)
const LIFF_ID = '2005230346-2OVa774O';

const SHEET_TX = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortรายการฝากและถอน';

let TX=[];

function toNumber(val){ return Number(String(val||'').replace(/[, ]/g,'')); }
function fmtNumber(n){ n=toNumber(n); return isFinite(n)? n.toLocaleString('th-TH') : String(n); }
function thaiDateString(d){ if(!d) d=new Date(); return d.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}); }
function parseThaiDate(s){ try{ s=String(s); const [datePart,timePart='00:00:00']=s.split(',').map(x=>x.trim()); const [d,m,y]=datePart.split('/').map(x=>parseInt(x,10)); const [hh,mm,ss]=timePart.split(':').map(x=>parseInt(x,10)); const gy=(y>2400)? y-543: y; return new Date(gy, m-1, d, hh||0, mm||0, ss||0);}catch(e){ return null; } }

async function fetchJSON(url){ const res=await fetch(url+'?ts='+Date.now(), {cache:'no-store'}); if(!res.ok) throw new Error('HTTP '+res.status); return await res.json(); }

function latestTermFromTX(){
  const terms = Array.from(new Set((TX||[]).map(r=>String(r['ปีการศึกษา']||'').trim()).filter(Boolean)));
  if(!terms.length) return null;
  const parsed = terms.map(s=>{ const [t,y]=s.split('/'); return {s, t:+t||0, y:+y||0}; }).sort((a,b)=> b.y-a.y || b.t-a.t);
  return parsed[0]?.s || null;
}

function getRangeByScope(scope){
  if(scope==='term'){ return {type:'term', value: chosenTerm()}; }
  const now=new Date();
  if(scope==='week'){ const start=new Date(now); const day=(now.getDay()+6)%7; start.setDate(now.getDate()-day); start.setHours(0,0,0,0); const end=new Date(start); end.setDate(start.getDate()+7); return {type:'range',start,end}; }
  const startM=new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0); const endM=new Date(now.getFullYear(), now.getMonth()+1, 1, 0,0,0,0); return {type:'range',start:startM,end:endM};
}
function inRange(d,start,end){ return d && d>=start && d<end; }
function inScopeTx(r,scopeObj){ if(scopeObj.type==='term'){ return String(r['ปีการศึกษา']||'').trim() === scopeObj.value; } const d=parseThaiDate(r['วันที่']); return inRange(d, scopeObj.start, scopeObj.end); }

function aggregateClass(scope){
  const s=getRangeByScope(scope);
  const agg=new Map();
  (TX||[]).forEach(r=>{
    if(!inScopeTx(r,s)) return;
    const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ');
    const act=String(r['รายการ']||'').trim();
    const amt=toNumber(r['จำนวนเงิน']);
    const obj=agg.get(cls)||{depC:0,wdrC:0,dep:0,wdr:0};
    if(act==='ฝาก'){ obj.depC++; obj.dep+=isFinite(amt)?amt:0; }
    else if(act==='ถอน'){ obj.wdrC++; obj.wdr+=isFinite(amt)?amt:0; }
    agg.set(cls,obj);
  });
  const rows=[];
  agg.forEach((v,k)=> rows.push({ชั้น:k,ครั้งฝาก:v.depC,ครั้งถอน:v.wdrC,รวมฝาก:v.dep,รวมถอน:v.wdr,สุทธิ:(v.dep - v.wdr)}));
  rows.sort((a,b)=> b.สุทธิ - a.สุทธิ);
  return rows;
}

function renderLeaderboard(scope){
  const rows=aggregateClass(scope);
  const body=document.getElementById('leader-body'); body.innerHTML='';
  updateAcademicLabel();
  if(!rows.length){ body.innerHTML='<tr><td colspan="6">ไม่พบข้อมูล</td></tr>'; return; }
  rows.forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${r.ชั้น}</td><td>${r.ครั้งฝาก}</td><td>${r.ครั้งถอน}</td><td>${fmtNumber(r.รวมฝาก)}</td><td>${fmtNumber(r.รวมถอน)}</td><td>${fmtNumber(r.สุทธิ)}</td>`;
    body.appendChild(tr);
  });
}

// Academic select
const STATE = { selectedAcademic: '' };
function collectAcademicYears(){
  const terms = Array.from(new Set((TX||[]).map(r=>String(r['ปีการศึกษา']||'').trim()).filter(Boolean)));
  const parsed = terms.map(s=>{ const [t,y]=s.split('/'); return {s, t:+t||0, y:+y||0}; }).sort((a,b)=> b.y-a.y || b.t-a.t);
  return parsed.map(p=>p.s);
}
function populateAcademicSelect(){
  const sel=document.getElementById('lb-year'); if(!sel) return;
  sel.innerHTML = '<option value=\"\">อัตโนมัติ</option>';
  collectAcademicYears().forEach(s=>{ const opt=document.createElement('option'); opt.value=s; opt.textContent=s; sel.appendChild(opt); });
  sel.addEventListener('change', ()=>{
    STATE.selectedAcademic = sel.value || '';
    updateAcademicLabel();
    const active = document.querySelector('#view-leaderboard .pill.active')?.dataset.scope || 'week';
    renderLeaderboard(active);
  });
}
function chosenTerm(){ return STATE.selectedAcademic || latestTermFromTX(); }
function updateAcademicLabel(){ const el=document.getElementById('lb-academic'); const yr=chosenTerm(); if(el) el.textContent = yr || '-'; }

// LIFF
async function ensureLogin(){ try{ await liff.init({liffId:LIFF_ID}); }catch(e){} if(!liff.isLoggedIn()){ await Swal.fire({title:'ต้องเข้าสู่ระบบ LINE',text:'เพื่อแชร์ผ่าน LINE จำเป็นต้องเข้าสู่ระบบก่อน',icon:'info',confirmButtonText:'เข้าสู่ระบบ'}); liff.login({redirectUri:location.href}); throw new Error('login-redirect'); } }
async function loadProfileAvatar(){ try{ await liff.init({liffId:LIFF_ID}); if(liff.isLoggedIn()){ const p=await liff.getProfile(); if(p && p.pictureUrl) document.getElementById('avatar').src=p.pictureUrl; if(p && p.displayName){ document.getElementById('prof-name').textContent=p.displayName; document.getElementById('prof-status').textContent='เข้าสู่ระบบแล้ว'; } document.getElementById('loginBadge').classList.remove('show'); } else { document.getElementById('prof-status').textContent='ยังไม่เข้าสู่ระบบ'; document.getElementById('loginBadge').classList.add('show'); } }catch(e){ document.getElementById('prof-status').textContent='ยังไม่เข้าสู่ระบบ'; document.getElementById('loginBadge').classList.add('show'); } }

// Supabase enrichment
const BOOT_URL = window.SUPABASE_BOOT_URL || localStorage.getItem('supabase_boot_url') || null;
const BOOT_KEY = window.SUPABASE_BOOT_KEY || localStorage.getItem('supabase_boot_key') || null;
async function getSupabaseKeys(){
  if(window.SUPABASE_URL && window.SUPABASE_ANON_KEY) return {url:window.SUPABASE_URL, key:window.SUPABASE_ANON_KEY};
  if(BOOT_URL && BOOT_KEY){
    const res = await fetch(`${BOOT_URL}/rest/v1/settings?select=key,value`,{headers:{apikey:BOOT_KEY, Authorization:`Bearer ${BOOT_KEY}`}, cache:'no-store'});
    if(res.ok){
      const rows = await res.json();
      const u = rows.find(r=>r.key==='supabase_url')?.value;
      const k = rows.find(r=>r.key==='supabase_anon_key')?.value;
      if(u && k) return {url:u, key:k};
    }
  }
  return null;
}
async function fetchUserFromSupabase(lineUserId){
  const keys = await getSupabaseKeys(); if(!keys) return null;
  const url = `${keys.url}/rest/v1/users?select=line_user_id,display_name,picture_url,role,classroom,phone,email&line_user_id=eq.${encodeURIComponent(lineUserId)}`;
  const res = await fetch(url,{headers:{apikey:keys.key, Authorization:`Bearer ${keys.key}`}, cache:'no-store'});
  if(!res.ok) return null;
  const rows=await res.json(); return Array.isArray(rows)&&rows[0]? rows[0]: null;
}
async function enrichProfile(){
  try{
    await liff.init({liffId:LIFF_ID});
    if(!liff.isLoggedIn()) return;
    const profile = await liff.getProfile();
    const decoded = liff.getDecodedIDToken && liff.getDecodedIDToken();
    const lineId = profile?.userId || decoded?.sub || null;
    if(!lineId) return;
    const u = await fetchUserFromSupabase(lineId);
    if(!u) return;
    document.getElementById('prof-name').textContent = u.display_name || profile.displayName || '-';
    document.getElementById('prof-status').textContent = 'เข้าสู่ระบบแล้ว';
    const grid=document.querySelector('#view-profile .profile-grid');
    function add(label,value){ const d=document.createElement('div'); d.innerHTML=`<strong>${label}:</strong> <span>${value||'-'}</span>`; grid.appendChild(d); }
    add('บทบาท', u.role); add('ชั้น/ห้อง', u.classroom); add('โทร', u.phone); add('อีเมล', u.email);
    if(u.picture_url) document.getElementById('avatar').src = u.picture_url;
  }catch(e){}
}

// Share leaderboard
function scopeLabelTH(s){ return s==='week'?'สัปดาห์นี้':(s==='month'?'เดือนนี้':'เทอมนี้'); }
function flexWithOpenButton(bubble){ const uri='https://liff.line.me/'+LIFF_ID; bubble.footer={type:'box',layout:'vertical',spacing:'sm',contents:[{type:'button',style:'primary',action:{type:'uri',label:'เปิด WDBank (LIFF)',uri}}]}; return bubble; }
async function shareLeaderboard(){
  await ensureLogin();
  const scope = document.querySelector('#view-leaderboard .pill.active')?.dataset.scope || 'week';
  const rows = aggregateClass(scope).slice(0,10);
  if(!(rows && rows.length)) return Swal.fire('ไม่มีข้อมูลสำหรับแชร์');
  const headers=['ชั้น','ครั้งฝาก','ครั้งถอน','รวมฝาก','รวมถอน','สุทธิ'];
  const headerBox={type:'box',layout:'horizontal',contents:headers.map(h=>({type:'text',text:h,size:'xs',weight:'bold',align:'center',flex:1}))};
  const dataRows=rows.map((r,i)=>({type:'box',layout:'horizontal',backgroundColor:(i%2?'#FFFFFF':'#F5F6FA'),
    contents:[{type:'text',text:String(r.ชั้น),size:'xs',align:'center',flex:1},{type:'text',text:String(r.ครั้งฝาก),size:'xs',align:'center',flex:1},{type:'text',text:String(r.ครั้งถอน),size:'xs',align:'center',flex:1},{type:'text',text:fmtNumber(r.รวมฝาก),size:'xs',align:'center',flex:1},{type:'text',text:fmtNumber(r.รวมถอน),size:'xs',align:'center',flex:1},{type:'text',text:fmtNumber(r.สุทธิ),size:'xs',align:'center',flex:1}]}));
  const yr = chosenTerm();
  const bubble={type:'bubble',size:'giga',body:{type:'box',layout:'vertical',contents:[
    {type:'text',text:'WDBank • ลีดเดอร์บอร์ดระดับชั้น',weight:'bold',size:'lg'},
    {type:'text',text:`ช่วง: ${scopeLabelTH(scope)} • ปีการศึกษา ${yr||'-'} • ${thaiDateString()}`,color:'#7286D3',size:'sm'},
    {type:'separator',margin:'md'}, headerBox, {type:'separator',margin:'sm'},
    {type:'box',layout:'vertical',margin:'md',spacing:'sm',contents:dataRows}
  ]}};
  const flex={type:'flex',altText:'WDBank • ลีดเดอร์บอร์ด',contents:flexWithOpenButton(bubble)};
  await liff.shareTargetPicker([flex]); if(liff.closeWindow) liff.closeWindow();
}

// PDF (leaderboard only minimal here)
function buildPDFShell(title){ const school='โรงเรียนของเรา'; const wrap=document.createElement('div'); const header=document.createElement('div'); header.className='header'; const h1=document.createElement('h1'); h1.textContent=title; const meta=document.createElement('div'); meta.className='meta'; meta.textContent = school+' • ออมก่อนใช้ • วันที่ '+thaiDateString(); header.appendChild(h1); wrap.appendChild(header); wrap.appendChild(meta); return wrap; }
async function renderPDF(node, filename){ const report=document.getElementById('pdfReport'); report.innerHTML=''; report.appendChild(node); const canvas=await html2canvas(report,{scale:2, backgroundColor:'#ffffff'}); const img=canvas.toDataURL('image/png'); const {jsPDF}=window.jspdf; const pdf=new jsPDF({orientation:'p', unit:'pt', format:'a4'}); const pageWidth=pdf.internal.pageSize.getWidth(); const margin=24; const imgWidth=pageWidth - margin*2; const imgHeight=canvas.height*imgWidth/canvas.width; pdf.addImage(img,'PNG',margin,margin,imgWidth,imgHeight); pdf.save(filename); }
function buildPDFTable(headers, rows){ const table=document.createElement('table'); const thead=document.createElement('thead'); const trh=document.createElement('tr'); headers.forEach(h=>{ const th=document.createElement('th'); th.textContent=h; trh.appendChild(th); }); thead.appendChild(trh); table.appendChild(thead); const tbody=document.createElement('tbody'); rows.forEach(r=>{ const tr=document.createElement('tr'); headers.forEach(h=>{ const td=document.createElement('td'); const v=r[h]; td.textContent = (typeof v==='number')? fmtNumber(v) : String(v); tr.appendChild(td); }); tbody.appendChild(tr); }); table.appendChild(tbody); return table; }
async function exportLeaderboardPDF(scope){ const rows=aggregateClass(scope); if(!(rows && rows.length)) return alert('ไม่มีข้อมูลสำหรับรายงาน'); const headers=['ชั้น','ครั้งฝาก','ครั้งถอน','รวมฝาก','รวมถอน','สุทธิ']; const dataRows=rows.map(r=>({'ชั้น':r.ชั้น,'ครั้งฝาก':r.ครั้งฝาก,'ครั้งถอน':r.ครั้งถอน,'รวมฝาก':r.รวมฝาก,'รวมถอน':r.รวมถอน,'สุทธิ':r.สุทธิ})); const wrap=buildPDFShell('ลีดเดอร์บอร์ดระดับชั้น • '+(scopeLabelTH(scope))); const yrNote=document.createElement('div'); yrNote.className='meta'; yrNote.textContent='ปีการศึกษา: '+(chosenTerm()||'-'); wrap.appendChild(yrNote); wrap.appendChild(buildPDFTable(headers,dataRows)); await renderPDF(wrap, 'WDBank-leaderboard-'+scope+'-'+new Date().toISOString().slice(0,10)+'.pdf'); }

// Setup
function switchView(view){ document.querySelectorAll('.view').forEach(v=>v.classList.remove('show')); document.getElementById('view-'+view).classList.add('show'); document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===view)); }
document.addEventListener('DOMContentLoaded', async ()=>{
  document.querySelectorAll('.nav-btn').forEach(b=> b.addEventListener('click', ()=>switchView(b.dataset.view)));
  document.querySelectorAll('#view-leaderboard .pill').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('#view-leaderboard .pill').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); renderLeaderboard(btn.dataset.scope);
    });
  });
  document.getElementById('lb-share').addEventListener('click', shareLeaderboard);
  document.getElementById('lb-pdf-week').addEventListener('click', ()=>exportLeaderboardPDF('week'));
  document.getElementById('lb-pdf-month').addEventListener('click', ()=>exportLeaderboardPDF('month'));
  document.getElementById('lb-pdf-term').addEventListener('click', ()=>exportLeaderboardPDF('term'));

  try{ TX = await fetchJSON(SHEET_TX); }catch(e){ console.error(e); }
  populateAcademicSelect(); updateAcademicLabel(); renderLeaderboard('week');
  loadProfileAvatar().then(enrichProfile);
});
