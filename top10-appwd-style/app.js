// Config
const LIFF_ID=''; // ใส่ LIFF ID ของพี่ถ้าจะใช้แชร์ LINE
const SHEET_TX='https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortรายการฝากและถอน';
let TX=[];

// Helpers
const $id = (id)=>document.getElementById(id);
const setText=(id,t)=>{ const el=$id(id); if(el) el.textContent=t; };
function thaiDateString(d){ if(!d) d=new Date(); return d.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}); }
function parseThaiDate(s){ try{ s=String(s); const [datePart,timePart='00:00:00']=s.split(',').map(x=>x.trim()); const [d,m,y]=datePart.split('/').map(n=>parseInt(n,10)); const [hh,mm,ss]=timePart.split(':').map(n=>parseInt(n,10)); const gy=(y>2400? y-543:y); return new Date(gy,m-1,d,hh||0,mm||0,ss||0);}catch(e){return null;} }
function inRange(d,s,e){ return d && d>=s && d<e; }
function monthRange(date){ const start=new Date(date.getFullYear(),date.getMonth(),1); const end=new Date(date.getFullYear(),date.getMonth()+1,1); return {start,end}; }
function weekRange(date){ const d=new Date(date); const day=(d.getDay()+6)%7; const start=new Date(d); start.setDate(d.getDate()-day); start.setHours(0,0,0,0); const end=new Date(start); end.setDate(start.getDate()+7); return {start,end}; }
function toNumber(x){ return Number(String(x||'').replace(/[, ]/g,'')); }
function fmtNumber(x){ const n=toNumber(x); return isFinite(n)? n.toLocaleString('th-TH') : String(x||''); }
function maskAcc(x){ const raw=String(x||'').replace(/[ ,]/g,''); if(!raw) return '-'; return raw.slice(0,4)+' \u2022\u2022'; }

// Mini tips
const MINI_TIPS=['ออมเล็กๆ แต่บ่อยๆ ดีต่อวินัย 💪','ตั้งเวลาออมประจำ ⏰','ตั้งเป้าสั้นรายสัปดาห์ ✨','ออมก่อนใช้ แยกทันที 💼','ออมทั้งห้อง สนุกขึ้น 🤝'];
function setMiniTip(){
  const el=$id('miniTip'); if(!el) return; const idx=Math.floor(Date.now()/86400000)%MINI_TIPS.length;
  el.textContent=MINI_TIPS[idx]; el.classList.remove('sk','sk-title');
}
$id('btnNextTip')?.addEventListener('click', ()=>{ const el=$id('miniTip'); if(el) el.textContent = MINI_TIPS[Math.floor(Math.random()*MINI_TIPS.length)]; });

// Load data
async function fetchJSON(url){ const res=await fetch(url+(url.includes('?')?'&':'?')+'_ts='+Date.now(),{cache:'no-store'}); if(!res.ok) throw new Error(res.statusText); return res.json(); }
async function loadTX(){ try{ TX=await fetchJSON(SHEET_TX); }catch(e){ console.warn('TX load error', e); } }

// Monthly delta (robust wait)
let __deltaTried=0;
async function computeMonthlyDeltaCard(){
  const maxTry=20;
  if(!TX || TX.length===0){
    if(__deltaTried<maxTry){ __deltaTried++; return setTimeout(computeMonthlyDeltaCard, 300); }
    return;
  }
  const now=new Date(); const mr=monthRange(now); const prev=monthRange(new Date(now.getFullYear(),now.getMonth()-1,1));
  const mapNow=new Map(), mapPrev=new Map();
  TX.forEach(r=>{
    const d=parseThaiDate(r['วันที่']); if(!d) return;
    const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(!acc) return;
    if(r['รายการ']==='ฝาก'){
      if(inRange(d,mr.start,mr.end)) mapNow.set(acc,(mapNow.get(acc)||0)+1);
      if(inRange(d,prev.start,prev.end)) mapPrev.set(acc,(mapPrev.get(acc)||0)+1);
    }
  });
  const avgNow = (mapNow.size? [...mapNow.values()].reduce((a,b)=>a+b,0)/mapNow.size : 0);
  const avgPrev= (mapPrev.size? [...mapPrev.values()].reduce((a,b)=>a+b,0)/mapPrev.size : 0);
  const pct=(avgPrev>0)? ((avgNow-avgPrev)/avgPrev*100): (avgNow>0? 100:0);
  setText('deltaPct',(pct>=0?'+':'')+pct.toFixed(0)+'%');
  setText('avgThisMonth', isFinite(avgNow)? avgNow.toFixed(2):'-');
  setText('avgBaseline',  isFinite(avgPrev)? avgPrev.toFixed(2):'—');
  ['deltaPct','avgThisMonth','avgBaseline'].forEach(id=>$id(id)?.classList.remove('sk','sk-title'));
}

// Leaderboard + Report Hub
function currentTermRange(){
  // derive latest term from TX['ปีการศึกษา'] like "1/2568"
  let latest=null;
  (TX||[]).forEach(r=>{
    const s=String(r['ปีการศึกษา']||'').trim(); const m=s.match(/^([12])\/(\d{4})$/);
    if(m){ const t=+m[1], y=+m[2]; if(!latest || y>latest.y || (y===latest.y && t>latest.t)){ latest={t,y}; } }
  });
  if(latest){ const y=latest.y>2400? latest.y-543:latest.y; if(latest.t===1){ return {start:new Date(y,4,1), end:new Date(y,10,1)}; } else { return {start:new Date(y,10,1), end:new Date(y+1,4,30,23,59,59,999)}; } }
  return monthRange(new Date());
}
function filterByRange(arr, keyDate, range){ return (arr||[]).filter(r=>{ const d=parseThaiDate(r[keyDate]); return inRange(d, range.start, range.end); }); }
function leaderboardData(mode){
  let range;
  if(mode==='week') range=weekRange(new Date());
  else if(mode==='month') range=monthRange(new Date());
  else range=currentTermRange();
  const sample = filterByRange(TX, 'วันที่', range);
  const perAcc = new Map();
  sample.forEach(r=>{
    const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(!acc) return;
    const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ');
    const act=String(r['รายการ']||''); const amt=toNumber(r['จำนวนเงิน']);
    const node=perAcc.get(acc)||{depCount:0,depSum:0,cls};
    if(act==='ฝาก'){ node.depCount += 1; node.depSum += isFinite(amt)? amt:0; }
    perAcc.set(acc,node);
  });
  const counts=[...perAcc.values()].map(v=>v.depCount).filter(v=>v>0);
  const baseline=counts.length? counts.reduce((a,b)=>a+b,0)/counts.length : 0;
  const rows=[...perAcc.entries()].map(([acc,info])=>({ acc, cls:info.cls, depCount:info.depCount, depSum:info.depSum, score: info.depCount + (info.depCount>=baseline?0.5:0)})).filter(r=>r.depCount>0);
  rows.sort((a,b)=> b.score-a.score || b.depCount-a.depCount || b.depSum-a.depSum);
  return {rows, baseline, range};
}
function renderLeaderboard(mode){
  const {rows, baseline} = leaderboardData(mode);
  const grid=$id('lb-grid'); if(!grid) return;
  grid.innerHTML='';
  rows.slice(0,10).forEach((r,i)=>{
    const div=document.createElement('div'); div.className='lb-card';
    div.innerHTML = `<div class="lb-rank">${i+1}</div>
      <div class="lb-body">
        <div class="lb-name">${maskAcc(r.acc)}</div>
        <div class="lb-sub">ชั้น ${r.cls} • ฝาก ${r.depCount} ครั้ง • ${fmtNumber(r.depSum)} บาท</div>
      </div>`;
    grid.appendChild(div);
  });
  setText('lb-desc','เกณฑ์อ้างอิง (ฝากเฉลี่ยต่อบัญชี) = '+(baseline? baseline.toFixed(2):'0'));
}
let barChart, lineChart;
function setCharts(mode){
  const {rows, range} = leaderboardData(mode);
  const ctx1=$id('barOverall')?.getContext('2d'); const ctx2=$id('lineTrend')?.getContext('2d');
  if(!ctx1 || !ctx2) return;
  const top=rows.slice(0,10);
  const labels=top.map(r=>maskAcc(r.acc));
  const depCounts=top.map(r=>r.depCount);
  const depSums=top.map(r=>r.depSum);
  // daily trend
  const span=[]; const d0=new Date(range.start), d1=new Date(range.end);
  for(let d=new Date(d0); d<d1; d.setDate(d.getDate()+1)){ span.push(new Date(d)); }
  const dailyDep = span.map(d=>{
    const dayTx=(TX||[]).filter(r=>{ const t=parseThaiDate(r['วันที่']); return t && t.getFullYear()==d.getFullYear() && t.getMonth()==d.getMonth() && t.getDate()==d.getDate() && r['รายการ']==='ฝาก'; });
    return dayTx.reduce((a,b)=>a+toNumber(b['จำนวนเงิน']),0);
  });
  if(barChart) barChart.destroy(); if(lineChart) lineChart.destroy();
  barChart = new Chart(ctx1, { type:'bar', data:{ labels, datasets:[{label:'จำนวนครั้งฝาก (Top 10)', data:depCounts},{label:'ยอดฝากรวม (บาท)', data:depSums}] }, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}} });
  lineChart = new Chart(ctx2, { type:'line', data:{ labels:span.map(d=>d.toLocaleDateString('th-TH',{month:'short',day:'numeric'})), datasets:[{label:'ยอดฝากรายวัน (บาท)', data:dailyDep}] }, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}} });
}

// Share leaderboard (optional LIFF)
async function shareLeaderboard(){
  try{ if(typeof liff!=='undefined' && LIFF_ID){ try{ await liff.init({liffId:LIFF_ID}); }catch(e){} if(!liff.isLoggedIn()){ await Swal.fire({title:'ต้องเข้าสู่ระบบ LINE',text:'เพื่อแชร์ลีดเดอร์บอร์ด',icon:'info',confirmButtonText:'เข้าสู่ระบบ'}); liff.login({redirectUri:location.href}); return; } } }catch(e){}
  const modeBtn = document.querySelector('[data-lb].active') || document.querySelector('[data-lb="week"]');
  const mode = modeBtn ? modeBtn.getAttribute('data-lb') : 'week';
  const {rows} = leaderboardData(mode);
  const headers=['อันดับ','บัญชี','ชั้น','ครั้งฝาก','ยอดรวม'];
  const headerBox={type:'box',layout:'horizontal',contents:headers.map(h=>({type:'text',text:h,size:'xs',weight:'bold',align:'center',flex:1}))};
  const dataBoxes=rows.slice(0,10).map((r,i)=>({type:'box',layout:'horizontal',backgroundColor:i%2?'#FFFFFF':'#F5F6FA',contents:[
    {type:'text',text:String(i+1),size:'xs',align:'center',flex:1},
    {type:'text',text:maskAcc(r.acc),size:'xs',align:'center',flex:2},
    {type:'text',text:r.cls,size:'xs',align:'center',flex:1},
    {type:'text',text:String(r.depCount),size:'xs',align:'center',flex:1},
    {type:'text',text:fmtNumber(r.depSum),size:'xs',align:'center',flex:2},
  ]}));
  const bubble={type:'bubble',size:'giga',body:{type:'box',layout:'vertical',contents:[
    {type:'text',text:'WDBank • ลีดเดอร์บอร์ด ('+mode+')',weight:'bold',size:'lg'},
    {type:'text',text:thaiDateString(),color:'#7286D3',size:'sm'},
    {type:'separator',margin:'md'}, headerBox, {type:'separator',margin:'sm'},
    {type:'box',layout:'vertical',margin:'md',spacing:'sm',contents:dataBoxes}
  ]}, footer:{type:'box',layout:'vertical',spacing:'sm',contents:[{type:'button',style:'primary',action:{type:'uri',label:'เปิด WDBank (LIFF)',uri:'https://liff.line.me/'+LIFF_ID}}]}};
  try{ if(typeof liff!=='undefined' && LIFF_ID){ await liff.shareTargetPicker([{type:'flex',altText:'WDBank • ลีดเดอร์บอร์ด',contents:bubble}]); if(liff.closeWindow) liff.closeWindow(); } }catch(e){ console.warn('shareLeaderboard error', e); }
}

// Report Hub PDF
async function exportReportHubPDF(){
  try{
    const { jsPDF } = window.jspdf || {}; if(!jsPDF) return Swal.fire('ไม่พบ jsPDF');
    const doc=new jsPDF({unit:'pt',format:'a4'});
    doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.text('WDBank • Report Hub', 40, 40);
    doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.text(thaiDateString(), 40, 60);
    const bar=$id('barOverall'); if(bar){ const img=bar.toDataURL('image/png',1.0); doc.addImage(img,'PNG',40,80,515,220); }
    const line=$id('lineTrend'); if(line){ const img2=line.toDataURL('image/png',1.0); doc.addImage(img2,'PNG',40,320,515,220); }
    doc.save('wdbank-report-hub.pdf');
  }catch(e){ console.warn('exportReportHubPDF', e); }
}

// Nav
function setupNav(){
  document.querySelectorAll('.nav-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach(v=>v.classList.remove('show'));
      const view=$id('view-'+btn.dataset.view); if(view) view.classList.add('show');
    });
  });
}

// Bind
document.addEventListener('DOMContentLoaded', async ()=>{
  setMiniTip();
  setupNav();
  await loadTX();
  computeMonthlyDeltaCard();
  // default leaderboard render
  renderLeaderboard('week'); setCharts('week');
  document.querySelectorAll('[data-lb]').forEach(b=>b.addEventListener('click',()=>{ const m=b.getAttribute('data-lb'); document.querySelectorAll('[data-lb]').forEach(x=>x.classList.toggle('active',x===b)); renderLeaderboard(m); setCharts(m);}));
  document.querySelectorAll('[data-rg]').forEach(b=>b.addEventListener('click',()=>{ const m=b.getAttribute('data-rg'); document.querySelectorAll('[data-rg]').forEach(x=>x.classList.toggle('active',x===b)); setCharts(m);}));
  $id('share-leaderboard')?.addEventListener('click', shareLeaderboard);
  $id('dl-reporthub-pdf')?.addEventListener('click', exportReportHubPDF);
});


// v6.7: optimize loops for latest-first TX
function forEachTxInRangeLatestFirst(range, fn){
  // Assumes TX is sorted with latest first (desc). We'll stop once date < range.start.
  const arr = TX||[];
  for(let i=0;i<arr.length;i++){
    const r=arr[i]; const d=parseThaiDate(r['วันที่']); if(!d) continue;
    if(d<range.start) break; // older than start → remaining are older too
    if(d>=range.end) continue; // newer than end → skip but continue
    fn(r, d);
  }
}

// Override computeMonthlyDeltaCard to use optimized iterator (preserve behavior)
let __deltaTry_v67=0;
async function computeMonthlyDeltaCard_v67(){
  if(!TX || TX.length===0){ if(__deltaTry_v67<20){ __deltaTry_v67++; return setTimeout(computeMonthlyDeltaCard_v67, 250); } else return; }
  const now=new Date(); const mr=monthRange(now); const prev=monthRange(new Date(now.getFullYear(),now.getMonth()-1,1));
  const mapNow=new Map(), mapPrev=new Map();
  forEachTxInRangeLatestFirst(mr, (r)=>{ if(r['รายการ']==='ฝาก'){ const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(acc) mapNow.set(acc,(mapNow.get(acc)||0)+1); } });
  forEachTxInRangeLatestFirst(prev, (r)=>{ if(r['รายการ']==='ฝาก'){ const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(acc) mapPrev.set(acc,(mapPrev.get(acc)||0)+1); } });
  const avgNow = (mapNow.size? [...mapNow.values()].reduce((a,b)=>a+b,0)/mapNow.size : 0);
  const avgPrev= (mapPrev.size? [...mapPrev.values()].reduce((a,b)=>a+b,0)/mapPrev.size : 0);
  const pct=(avgPrev>0)? ((avgNow-avgPrev)/avgPrev*100): (avgNow>0? 100:0);
  (function(id,t){const el=document.getElementById(id); if(el) el.textContent=t;})('deltaPct',(pct>=0?'+':'')+pct.toFixed(0)+'%');
  (function(id,t){const el=document.getElementById(id); if(el) el.textContent=t;})('avgThisMonth', isFinite(avgNow)? avgNow.toFixed(2):'-');
  (function(id,t){const el=document.getElementById(id); if(el) el.textContent=t;})('avgBaseline',  isFinite(avgPrev)? avgPrev.toFixed(2):'—');
  ['deltaPct','avgThisMonth','avgBaseline'].forEach(id=>{ const el=document.getElementById(id); el && el.classList.remove('sk','sk-title'); });
}

// Replace previous call bindings to use v67 version (add a safe fallback)
document.addEventListener('DOMContentLoaded', ()=>{ try{ computeMonthlyDeltaCard_v67(); }catch(e){ try{ computeMonthlyDeltaCard(); }catch(_){ } } });

// Optimize leaderboard data and charts using latest-first short-circuit
const _ld_old = leaderboardData;
leaderboardData = function(mode){
  let range;
  if(mode==='week') range=weekRange(new Date());
  else if(mode==='month') range=monthRange(new Date());
  else range=currentTermRange();
  const perAcc = new Map();
  forEachTxInRangeLatestFirst(range, (r)=>{
    const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(!acc) return;
    const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ');
    const act=String(r['รายการ']||''); const amt=toNumber(r['จำนวนเงิน']);
    const node=perAcc.get(acc)||{depCount:0,depSum:0,cls};
    if(act==='ฝาก'){ node.depCount += 1; node.depSum += isFinite(amt)? amt:0; }
    perAcc.set(acc,node);
  });
  const counts=[...perAcc.values()].map(v=>v.depCount).filter(v=>v>0);
  const baseline=counts.length? counts.reduce((a,b)=>a+b,0)/counts.length : 0;
  const rows=[...perAcc.entries()].map(([acc,info])=>({ acc, cls:info.cls, depCount:info.depCount, depSum:info.depSum, score: info.depCount + (info.depCount>=baseline?0.5:0)})).filter(r=>r.depCount>0);
  rows.sort((a,b)=> b.score-a.score || b.depCount-a.depCount || b.depSum-a.depSum);
  return {rows, baseline, range};
};
