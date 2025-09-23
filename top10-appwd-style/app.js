const LIFF_ID = '2005230346-2OVa774O';
let TX=[];
function thaiDateString(d){ if(!d) d=new Date(); return d.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}); }
function toNumber(v){ return Number(String(v||'').replace(/[, ]/g,'')); }
function fmtNumber(v){ const n=toNumber(v); return isFinite(n)? n.toLocaleString('th-TH',{maximumFractionDigits:2}):String(v??''); }
function parseThaiDate(s){ try{ s=String(s); const [dpart,tpart='00:00:00']=s.split(',').map(x=>x.trim()); const [dd,mm,yy]=dpart.split('/').map(n=>parseInt(n,10)); const [hh,mi,ss]=tpart.split(':').map(n=>parseInt(n,10)); const gy=yy>2400? yy-543:yy; return new Date(gy,mm-1,dd,hh||0,mi||0,ss||0);}catch(e){return null;} }
async function fetchJSON(url){ const r=await fetch(url); if(!r.ok) throw new Error(r.status); return await r.json(); }
const SHEET_TX='https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortรายการฝากและถอน';

function latestTermFromTX(){
  const terms = Array.from(new Set((TX||[]).map(r=>String(r['ปีการศึกษา']||'').trim()).filter(Boolean)));
  if(!terms.length) return null;
  const parsed = terms.map(s=>{ const [t,y]=s.split('/'); return {s, t:+t, y:+y}; })
    .filter(x=>!isNaN(x.t)&&!isNaN(x.y))
    .sort((a,b)=> b.y-a.y || b.t-a.t);
  return parsed[0]?.s || null;
}
// year selector helpers
function collectTermsFromTX(){
  const set=new Set(); (TX||[]).forEach(r=>{ const s=String(r['ปีการศึกษา']||'').trim(); if(s) set.add(s); });
  return Array.from(set).map(s=>{ const [t,y]=s.split('/'); return {s, t:+t, y:+y}; })
    .filter(x=>!isNaN(x.t)&&!isNaN(x.y))
    .sort((a,b)=> b.y-a.y || b.t-a.t)
    .map(x=>x.s);
}
function getSelectedTerm(){ const el=document.getElementById('lb-term-select'); return el && el.value ? el.value : latestTermFromTX(); }
function populateTermSelect(){
  const el=document.getElementById('lb-term-select'); if(!el) return;
  const terms=collectTermsFromTX(); el.innerHTML='';
  if(!terms.length){ el.innerHTML='<option value=\"\">-</option>'; return; }
  terms.forEach(s=>{ const o=document.createElement('option'); o.value=s; o.textContent=s; el.appendChild(o); });
  const latest=latestTermFromTX(); el.value = latest || terms[0];
  el.addEventListener('change', ()=>{ const scope=document.querySelector('#view-leaderboard .pill.active')?.dataset.scope || 'week'; if(scope==='term'){ renderLeaderboard('term'); } });
}

function getRangeByScope(scope){
  if(scope==='term'){ const t=getSelectedTerm() || latestTermFromTX(); return {type:'term', value:t}; }
  const now=new Date();
  if(scope==='week'){ const start=new Date(now); const day=(now.getDay()+6)%7; start.setDate(now.getDate()-day); start.setHours(0,0,0,0); const end=new Date(start); end.setDate(start.getDate()+7); return {type:'range',start,end}; }
  const startM=new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0); const endM=new Date(now.getFullYear(), now.getMonth()+1, 1, 0,0,0,0); return {type:'range',start:startM,end:endM};
}
function inRange(d,s,e){ return d && d>=s && d<e; }
function inScopeTx(r,scope){ if(scope.type==='term'){ return String(r['ปีการศึกษา']||'').trim()===scope.value; } const d=parseThaiDate(r['วันที่']); return inRange(d, scope.start, scope.end); }

function aggregateClass(scopeKey){
  const scope=getRangeByScope(scopeKey); const agg=new Map();
  (TX||[]).forEach(r=>{ if(!inScopeTx(r,scope)) return; const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ'); const act=String(r['รายการ']||'').trim(); const amt=toNumber(r['จำนวนเงิน']); const o=agg.get(cls)||{depC:0,wdrC:0,dep:0,wdr:0}; if(act==='ฝาก'){ o.depC++; o.dep+=isFinite(amt)?amt:0; } else if(act==='ถอน'){ o.wdrC++; o.wdr+=isFinite(amt)?amt:0; } agg.set(cls,o); });
  const rows=[]; agg.forEach((v,k)=>rows.push({ชั้น:k,ครั้งฝาก:v.depC,ครั้งถอน:v.wdrC,รวมฝาก:v.dep,รวมถอน:v.wdr,สุทธิ:v.dep-v.wdr}));
  rows.sort((a,b)=>b.สุทธิ-a.สุทธิ); return rows;
}
function renderLeaderboard(scopeKey){
  const rows=aggregateClass(scopeKey); const body=document.getElementById('leader-body'); body.innerHTML='';
  if(!rows.length){ body.innerHTML='<tr><td colspan=\"6\">ไม่พบข้อมูล</td></tr>'; return; }
  rows.forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.ชั้น}</td><td>${fmtNumber(r.ครั้งฝาก)}</td><td>${fmtNumber(r.ครั้งถอน)}</td><td>${fmtNumber(r.รวมฝาก)}</td><td>${fmtNumber(r.รวมถอน)}</td><td>${fmtNumber(r.สุทธิ)}</td>`; body.appendChild(tr); });
}

async function ensureLogin(){ try{ await liff.init({liffId:LIFF_ID}); }catch(e){} if(!liff.isLoggedIn()){ await Swal.fire({title:'ต้องเข้าสู่ระบบ LINE',text:'เพื่อแชร์ผ่าน LINE จำเป็นต้องเข้าสู่ระบบก่อน',icon:'info',confirmButtonText:'เข้าสู่ระบบ'}); liff.login({redirectUri:location.href}); throw new Error('login-redirect'); } }
function scopeLabelTH(s){ return s==='week'?'สัปดาห์นี้': s==='month'?'เดือนนี้':'เทอมนี้'; }
function flexWithOpenButton(bubble){ const uri='https://liff.line.me/'+LIFF_ID; bubble.footer={type:'box',layout:'vertical',spacing:'sm',contents:[{type:'button',style:'primary',action:{type:'uri',label:'เปิด WDBank (LIFF)',uri}}]}; return bubble; }
async function shareLeaderboard(){
  await ensureLogin();
  const scope=document.querySelector('#view-leaderboard .pill.active')?.dataset.scope || 'week';
  const rows=aggregateClass(scope).slice(0,10); if(!rows.length) return Swal.fire('ไม่มีข้อมูลสำหรับแชร์');
  const headers=['ชั้น','ครั้งฝาก','ครั้งถอน','รวมฝาก','รวมถอน','สุทธิ'];
  const headerBox={type:'box',layout:'horizontal',contents:headers.map(h=>({type:'text',text:h,size:'xs',weight:'bold',align:'center',flex:1}))};
  const dataRows=rows.map((r,i)=>({type:'box',layout:'horizontal',backgroundColor:i%2?'#FFFFFF':'#F5F6FA',contents:[
    {type:'text',text:String(r.ชั้น),size:'xs',align:'center',flex:1},
    {type:'text',text:String(r.ครั้งฝาก),size:'xs',align:'center',flex:1},
    {type:'text',text:String(r.ครั้งถอน),size:'xs',align:'center',flex:1},
    {type:'text',text:fmtNumber(r.รวมฝาก),size:'xs',align:'center',flex:1},
    {type:'text',text:fmtNumber(r.รวมถอน),size:'xs',align:'center',flex:1},
    {type:'text',text:fmtNumber(r.สุทธิ),size:'xs',align:'center',flex:1},
  ]}));
  const yr = getSelectedTerm() || latestTermFromTX();
  const bubble={type:'bubble',size:'giga',body:{type:'box',layout:'vertical',contents:[
    {type:'text',text:'WDBank • ลีดเดอร์บอร์ดระดับชั้น',weight:'bold',size:'lg'},
    {type:'text',text:`ช่วง: ${scopeLabelTH(scope)} • ปีการศึกษา ${yr||'-'} • ${thaiDateString()}`,color:'#7286D3',size:'sm'},
    {type:'separator',margin:'md'}, headerBox, {type:'separator',margin:'sm'},
    {type:'box',layout:'vertical',margin:'md',spacing:'sm',contents:dataRows}
  ]}};
  const flex={type:'flex',altText:'WDBank • ลีดเดอร์บอร์ด',contents:flexWithOpenButton(bubble)};
  await liff.shareTargetPicker([flex]); if(liff.closeWindow) liff.closeWindow();
}

function setupLeaderboard(){
  document.querySelectorAll('#view-leaderboard .pill').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('#view-leaderboard .pill').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); renderLeaderboard(btn.dataset.scope);
    });
  });
  var sh=document.getElementById('lb-share'); if(sh) sh.addEventListener('click', shareLeaderboard);
}

async function init(){ TX = await fetchJSON(SHEET_TX); populateTermSelect(); renderLeaderboard('week'); setupLeaderboard(); }
document.addEventListener('DOMContentLoaded', init);
