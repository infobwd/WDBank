const LIFF_ID='2005230346-2OVa774O';
const SHEET_TX='https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortรายการฝากและถอน';
const SHEET_ACCOUNTS='https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo//บัญชี';
let TX=[], AC=[];
const MINI_TIPS=['ออมเล็กๆ แต่บ่อยๆ ดีต่อวินัย 💪','ตั้งเวลาออมประจำ จ/พฤ 07:30 ⏰','ตั้งเป้าหมายสั้นรายสัปดาห์ ✨','ออมก่อนใช้ แยกทันทีที่ได้รับเงิน 💼','ชวนเพื่อนทั้งห้องออมพร้อมกัน 🤝'];

function thaiDateString(d){ if(!d) d=new Date(); return d.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}); }
function parseThaiDate(s){ try{ s=String(s); const [datePart,timePart='00:00:00']=s.split(',').map(x=>x.trim()); const [d,m,y]=datePart.split('/').map(n=>parseInt(n,10)); const [hh,mm,ss]=timePart.split(':').map(n=>parseInt(n,10)); const gy=(y>2400? y-543:y); return new Date(gy,m-1,d,hh||0,mm||0,ss||0);}catch(e){return null;} }
function inRange(d,s,e){ return d && d>=s && d<e; }
function monthRange(date){ const start=new Date(date.getFullYear(),date.getMonth(),1,0,0,0,0); const end=new Date(date.getFullYear(),date.getMonth()+1,1,0,0,0,0); return {start,end}; }
function toNumber(x){ return Number(String(x||'').replace(/[, ]/g,'')); }
function fmtNumber(x){ const n=toNumber(x); return isFinite(n)? n.toLocaleString('th-TH') : String(x||''); }
function formatAccountMasked(val){ const raw=String(val||'').replace(/[ ,]/g,''); if(!raw) return '-'; return raw.slice(0,4)+' ••'; }

function setMiniTip(){ const el=document.getElementById('miniTip'); const idx=Math.floor(Date.now()/86400000)%MINI_TIPS.length; el.textContent=MINI_TIPS[idx]; el.classList.remove('sk','sk-title'); }
document.getElementById('btnNextTip')?.addEventListener('click', ()=>{ const el=document.getElementById('miniTip'); el.textContent = MINI_TIPS[Math.floor(Math.random()*MINI_TIPS.length)]; });

async function fetchJSON(url){ const res=await fetch(url+(url.includes('?')?'&':'?')+'_ts='+Date.now(),{cache:'no-store'}); if(!res.ok) throw new Error(res.statusText); return res.json(); }

function computeMonthlyDeltaCard(){
  const now=new Date(); const {start,end}=monthRange(now); const prev=monthRange(new Date(now.getFullYear(),now.getMonth()-1,1));
  const mapNow=new Map(), mapPrev=new Map();
  (TX||[]).forEach(r=>{ const d=parseThaiDate(r['วันที่']); if(!d) return; const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(!acc) return; if(r['รายการ']==='ฝาก'){ if(inRange(d,start,end)) mapNow.set(acc,(mapNow.get(acc)||0)+1); if(inRange(d,prev.start,prev.end)) mapPrev.set(acc,(mapPrev.get(acc)||0)+1);} });
  const avgNow=[...mapNow.values()].reduce((a,b)=>a+b,0)/Math.max(mapNow.size,1);
  const avgPrev=[...mapPrev.values()].reduce((a,b)=>a+b,0)/Math.max(mapPrev.size,1);
  const pct=(avgPrev>0)? ((avgNow-avgPrev)/avgPrev*100):0;
  document.getElementById('deltaPct').textContent=(pct>=0?'+':'')+pct.toFixed(0)+'%';
  document.getElementById('avgThisMonth').textContent=isFinite(avgNow)?avgNow.toFixed(2):'-';
  document.getElementById('avgBaseline').textContent=isFinite(avgPrev)?avgPrev.toFixed(2):'—';
  ['deltaPct','avgThisMonth','avgBaseline'].forEach(id=>document.getElementById(id).classList.remove('sk','sk-title'));
}

function buildTeacher(){
  const now=new Date(); const {start,end}=monthRange(now);
  const perClass=new Map();
  (TX||[]).forEach(r=>{ const d=parseThaiDate(r['วันที่']); if(!inRange(d,start,end)) return; if(r['รายการ']!=='ฝาก') return; const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ'); const amt=toNumber(r['จำนวนเงิน']); const node=perClass.get(cls)||{acc:new Set(), cnt:new Map(), dep:0}; node.acc.add(acc); node.cnt.set(acc,(node.cnt.get(acc)||0)+1); node.dep+=isFinite(amt)?amt:0; perClass.set(cls,node); });
  (AC||[]).forEach(r=>{ const cls=String(r['ห้อง']||r['ชั้น']||'ไม่ระบุ'); const acc=String(r['รหัสนักเรียน']||r['บัญชี']||'').trim(); if(!acc) return; const node=perClass.get(cls)||{acc:new Set(), cnt:new Map(), dep:0}; node.acc.add(acc); if(!node.cnt.has(acc)) node.cnt.set(acc,0); perClass.set(cls,node); });
  const rows=[]; for(const [cls,node] of perClass.entries()){ const n=node.acc.size||1; const sum=[...node.cnt.values()].reduce((a,b)=>a+b,0); const avg=sum/n; const pct4=([...node.cnt.values()].filter(v=>v>=4).length/n)*100; rows.push({ชั้น:cls, จำนวนบัญชี:n, เฉลี่ย:avg, เปอร์เซ็นต์:pct4, รวมฝาก:node.dep}); }
  rows.sort((a,b)=>b.เปอร์เซ็นต์-a.เปอร์เซ็นต์);
  const tbody=document.getElementById('teacher-body'); tbody.innerHTML='';
  const sel=document.getElementById('classSelect'); sel.innerHTML='';
  rows.forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.ชั้น}</td><td>${r.จำนวนบัญชี}</td><td>${r.เฉลี่ย.toFixed(2)}</td><td>${r.เปอร์เซ็นต์.toFixed(0)}%</td><td>${fmtNumber(r.รวมฝาก)}</td>`; tbody.appendChild(tr); const opt=document.createElement('option'); opt.value=r.ชั้น; opt.textContent=r.ชั้น; sel.appendChild(opt); });
}

function latestTermFromTX(){ const terms=Array.from(new Set((TX||[]).map(r=>String(r['ปีการศึกษา']||'').trim()).filter(Boolean))); if(!terms.length) return null; const parsed=terms.map(s=>{const [t,y]=s.split('/'); return {s, t:+t, y:+y};}).filter(x=>!isNaN(x.t)&&!isNaN(x.y)).sort((a,b)=>b.y-a.y||b.t-a.t); return parsed[0]?.s||null; }

async function ensureLogin(){ try{ await liff.init({liffId:LIFF_ID}); }catch(e){} if(!liff.isLoggedIn()){ await Swal.fire({title:'ต้องเข้าสู่ระบบ LINE',text:'เพื่อแชร์ผ่าน LINE',icon:'info',confirmButtonText:'เข้าสู่ระบบ'}); liff.login({redirectUri:location.href}); throw new Error('login-redirect'); } }
function flexWithOpenButton(bubble){ const uri='https://liff.line.me/'+LIFF_ID; bubble.footer={type:'box',layout:'vertical',spacing:'sm',contents:[{type:'button',style:'primary',action:{type:'uri',label:'เปิด WDBank (LIFF)',uri}}]}; return bubble; }

async function shareClass(){ await ensureLogin(); const cls=document.getElementById('classSelect').value||'-'; const now=new Date(); const title='WDBank • สรุปห้อง '+cls; const headers=['ชั้น','บัญชี','เฉลี่ยฝาก/บัญชี','%ฝาก≥4ครั้ง','รวมฝาก']; const bubble={type:'bubble',size:'giga',body:{type:'box',layout:'vertical',contents:[{type:'text',text:title,weight:'bold',size:'lg'},{type:'text',text:'เดือนนี้ • '+thaiDateString(now),color:'#7286D3',size:'sm'},{type:'separator',margin:'md'}]}}; liff.shareTargetPicker([{type:'flex',altText:title,contents:flexWithOpenButton(bubble)}]); }

function setupNav(){ document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('.nav-btn').forEach(n=>n.classList.remove('active')); b.classList.add('active'); document.querySelectorAll('.view').forEach(v=>v.classList.remove('show')); document.getElementById('view-'+b.dataset.view).classList.add('show'); })); }

document.addEventListener('DOMContentLoaded', async ()=>{
  document.getElementById('todayThai').textContent=thaiDateString();
  setMiniTip();
  try{ const [tx,ac]=await Promise.all([fetchJSON(SHEET_TX), fetchJSON(SHEET_ACCOUNTS)]); TX=tx; AC=ac; }catch(e){ console.error(e); }
  computeMonthlyDeltaCard();
  buildTeacher();
  setupNav();
  document.getElementById('share-class')?.addEventListener('click', shareClass);
  document.getElementById('share-allstars')?.addEventListener('click', async ()=>{ try{ await ensureLogin(); Swal.fire('แชร์แล้ว','','success'); }catch(e){} });
  console.log('WDBank v6.5 (mini tips + teacher) ready');
});
