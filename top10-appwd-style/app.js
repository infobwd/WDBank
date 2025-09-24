// WDBank v6.6.1 — Home averages + Leaderboard/Report Hub
const LIFF_ID = ''; // ตั้งค่า LIFF ของพี่ถ้าต้องการแชร์ LINE

// ---- Safe DOM helpers ----
function $id(id){ return document.getElementById(id); }
function setText(id, t){ const el=$id(id); if(el) el.textContent=t; }
function setHTML(id, h){ const el=$id(id); if(el) el.innerHTML=h; }
function setSrc(id, u){ const el=$id(id); if(el) el.src=u; }

// ---- Date & number helpers ----
function thaiDateString(d){ if(!d) d=new Date(); return d.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}); }
function parseThaiDate(s){ try{ s=String(s); const [datePart,timePart='00:00:00']=s.split(',').map(x=>x.trim()); const [dd,mm,yy]=datePart.split('/').map(n=>parseInt(n,10)); const [HH,MM,SS]=timePart.split(':').map(n=>parseInt(n,10)); const gy=(yy>2400? yy-543: yy); return new Date(gy,(mm||1)-1,(dd||1),HH||0,MM||0,SS||0);}catch(e){return null;} }
function monthRange(date){ const s=new Date(date.getFullYear(), date.getMonth(), 1, 0,0,0,0); const e=new Date(date.getFullYear(), date.getMonth()+1, 1, 0,0,0,0); return {start:s,end:e}; }
function prevMonth(date){ return new Date(date.getFullYear(), date.getMonth()-1, 1); }
function weekRange(date){ const d=new Date(date); const day=(d.getDay()+6)%7; const start=new Date(d); start.setDate(d.getDate()-day); start.setHours(0,0,0,0); const end=new Date(start); end.setDate(start.getDate()+7); return {start,end}; }
function inRange(d,s,e){ return d && d>=s && d<e; }
function toNumber(v){ return Number(String(v??'').replace(/[, ]/g,'')); }
function fmtNumber(v){ const n=toNumber(v); return isFinite(n)? n.toLocaleString('th-TH', {maximumFractionDigits:2}) : String(v??''); }

// Data sources
const SHEET_TX='https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortรายการฝากและถอน';
let TX = window.TX || []; // allow host to inject

async function ensureTX(){
  if (Array.isArray(TX) && TX.length) return TX;
  try{
    const res = await fetch(SHEET_TX + (SHEET_TX.includes('?')?'&':'?') + '_ts=' + Date.now(), {cache:'no-store'});
    TX = await res.json();
    if(!Array.isArray(TX)) TX = [];
  }catch(e){ console.warn('ensureTX fetch error', e); TX = []; }
  return TX;
}

// Mini tips
const MINI_TIPS=[
  'ออมเล็ก ๆ แต่บ่อย ๆ ดีต่อวินัยมากกว่าครั้งละก้อนใหญ่ 💪',
  'ตั้งเวลาออมประจำ เช่น จันทร์/พฤ. หลังเข้าแถว 5 นาที ⏰',
  'ตั้งเป้าหมายสั้น ๆ รายสัปดาห์ จะเห็นความก้าวหน้าเร็วขึ้น ✨',
  'ออมก่อนใช้: แยกเงินออมทันทีที่ได้รับเงิน 💼',
  'ชวนเพื่อนทั้งห้องออมพร้อมกัน สนุกและมีแรงใจขึ้น 🤝'
];
function setMiniTip(){ const el=$id('miniTip'); if(!el) return; const idx=Math.floor(Date.now()/86400000)%MINI_TIPS.length; el.textContent=MINI_TIPS[idx]; el.classList.remove('sk','sk-title'); }
$id('btnNextTip')?.addEventListener('click', ()=>{ const el=$id('miniTip'); if(el) el.textContent = MINI_TIPS[Math.floor(Math.random()*MINI_TIPS.length)]; });

// Monthly averages (school & per-class), only accounts that deposited in that month
function averageDepositPerActiveAccount(tx, range){
  const countsByAcc = new Map();
  tx.forEach(r=>{
    if (String(r['รายการ']||'')!=='ฝาก') return;
    const d=parseThaiDate(r['วันที่']); if(!inRange(d, range.start, range.end)) return;
    const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(!acc) return;
    countsByAcc.set(acc, (countsByAcc.get(acc)||0)+1);
  });
  const active = [...countsByAcc.values()];
  const avg = active.length ? active.reduce((a,b)=>a+b,0)/active.length : 0;
  return {avg, countsByAcc};
}
function averageByClass(tx, range){
  const classMap=new Map();
  tx.forEach(r=>{
    if (String(r['รายการ']||'')!=='ฝาก') return;
    const d=parseThaiDate(r['วันที่']); if(!inRange(d, range.start, range.end)) return;
    const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(!acc) return;
    const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ');
    const m=classMap.get(cls)||new Map();
    m.set(acc,(m.get(acc)||0)+1);
    classMap.set(cls,m);
  });
  const rows=[];
  for(const [cls,m] of classMap.entries()){
    const arr=[...m.values()];
    const avg = arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
    rows.push({cls, avg});
  }
  rows.sort((a,b)=> b.avg - a.avg || (a.cls>b.cls?1:-1));
  return rows;
}

async function renderHomeCards(){
  const tx = await ensureTX();
  // KPI weekly (simple demo; keep skeleton off)
  const wr = weekRange(new Date());
  const sample = tx.filter(r=>{
    const d=parseThaiDate(r['วันที่']); return inRange(d, wr.start, wr.end);
  });
  const dep = sample.filter(r=>r['รายการ']==='ฝาก');
  const wdr = sample.filter(r=>r['รายการ']==='ถอน');
  const depCount=dep.length, wdrCount=wdr.length;
  const depSum=dep.reduce((a,b)=>a+toNumber(b['จำนวนเงิน']),0);
  const wdrSum=wdr.reduce((a,b)=>a+toNumber(b['จำนวนเงิน']),0);
  setText('kpiDepCount', fmtNumber(depCount));
  setText('kpiWdrCount', fmtNumber(wdrCount));
  setText('kpiDepSum', fmtNumber(depSum));
  setText('kpiWdrSum', fmtNumber(wdrSum));
  ['kpiDepCount','kpiWdrCount','kpiDepSum','kpiWdrSum'].forEach(id=>$id(id)?.classList.remove('sk','sk-title'));
  
  // Monthly delta + per-class
  const now = new Date();
  const mrThis = monthRange(now);
  const mrPrev = monthRange(prevMonth(now));
  const {avg:avgThis} = averageDepositPerActiveAccount(tx, mrThis);
  const {avg:avgPrev} = averageDepositPerActiveAccount(tx, mrPrev);
  const pct = (avgPrev>0)? ((avgThis-avgPrev)/avgPrev*100):0;
  setText('deltaPct', (pct>=0?'+':'')+ (isFinite(pct)? pct.toFixed(0): '0')+'%');
  setText('avgThisMonth', isFinite(avgThis)? avgThis.toFixed(2): '-');
  setText('avgBaseline', isFinite(avgPrev)? avgPrev.toFixed(2): '—');
  ['deltaPct','avgThisMonth','avgBaseline'].forEach(id=>$id(id)?.classList.remove('sk','sk-title'));

  const rowsThis=averageByClass(tx, mrThis);
  const prevMap=new Map(averageByClass(tx, mrPrev).map(r=>[r.cls,r.avg]));
  const tbody=$id('avgByClass'); if(tbody){ tbody.innerHTML=''; if(!rowsThis.length){ tbody.innerHTML='<tr><td colspan="3">ไม่พบข้อมูลการฝากเดือนนี้</td></tr>'; }else{
    rowsThis.forEach(r=>{ const prev=prevMap.get(r.cls)||0; const tr=document.createElement('tr');
      tr.innerHTML='<td>'+r.cls+'</td><td>'+r.avg.toFixed(2)+'</td><td>'+ (prev? prev.toFixed(2): '0.00') +'</td>'; tbody.appendChild(tr);
    });
  } }
}

// Leaderboard + Report Hub (same as previous v6.6 idea)
function currentTermRange(){
  // Try latest term from TX 'ปีการศึกษา' like "1/2568"
  const txArr = TX||[]; let latest=null;
  txArr.forEach(r=>{ const s=String(r['ปีการศึกษา']||'').trim(); const m=s.match(/^([12])\/(\d{4})$/); if(m){ const t=+m[1], y=+m[2]; if(!latest || y>latest.y || (y===latest.y && t>latest.t)) latest={t,y}; } });
  if(latest){ const y=latest.y>2400? latest.y-543: latest.y; if(latest.t===1) return {start:new Date(y,4,1), end:new Date(y,10,1)}; return {start:new Date(y,10,1), end:new Date(y+1,4,30,23,59,59,999)}; }
  return monthRange(new Date());
}
function leaderboardData(mode){
  let range; if(mode==='week') range=weekRange(new Date()); else if(mode==='month') range=monthRange(new Date()); else range=currentTermRange();
  const sample = (TX||[]).filter(r=>{ const d=parseThaiDate(r['วันที่']); return inRange(d, range.start, range.end); });
  const perAcc=new Map();
  sample.forEach(r=>{ const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(!acc) return; const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ'); const act=String(r['รายการ']||''); const amt=toNumber(r['จำนวนเงิน']); const node=perAcc.get(acc)||{depCount:0,depSum:0,cls}; if(act==='ฝาก'){ node.depCount+=1; node.depSum+=isFinite(amt)?amt:0; } perAcc.set(acc,node); });
  const counts=[...perAcc.values()].map(v=>v.depCount).filter(v=>v>0);
  const baseline = counts.length? counts.reduce((a,b)=>a+b,0)/counts.length : 0;
  const rows=[...perAcc.entries()].map(([acc,info])=>({acc,cls:info.cls,depCount:info.depCount,depSum:info.depSum,score: info.depCount + (info.depCount>=baseline?0.5:0)})).filter(r=>r.depCount>0);
  rows.sort((a,b)=> b.score-a.score || b.depCount-a.depCount || b.depSum-a.depSum);
  return {rows, baseline, range};
}
function formatAccountMasked(val){ const raw=String(val||'').replace(/[ ,]/g,''); if(!raw) return '-'; return raw.slice(0,4)+' \u2022\u2022'; }
function renderLeaderboard(mode){
  const {rows, baseline}=leaderboardData(mode);
  const grid=$id('lb-grid'); if(!grid) return; grid.innerHTML='';
  rows.slice(0,10).forEach((r,i)=>{ const div=document.createElement('div'); div.className='lb-card'; div.innerHTML='<div class="lb-rank">'+(i+1)+'</div><div class="lb-body"><div class="lb-name">'+formatAccountMasked(r.acc)+'</div><div class="lb-sub">ชั้น '+r.cls+' • ฝาก '+r.depCount+' ครั้ง • '+fmtNumber(r.depSum)+' บาท</div></div>'; grid.appendChild(div); });
  setText('lb-desc', 'เกณฑ์อ้างอิง (ฝากเฉลี่ยต่อบัญชี) = '+ (baseline? baseline.toFixed(2): '0'));
}

let barChart,lineChart;
function setCharts(mode){
  const {rows, range}=leaderboardData(mode);
  const ctx1=$id('barOverall')?.getContext('2d'); const ctx2=$id('lineTrend')?.getContext('2d'); if(!ctx1||!ctx2) return;
  const top=rows.slice(0,10); const labels=top.map(r=>formatAccountMasked(r.acc)); const depCounts=top.map(r=>r.depCount); const depSums=top.map(r=>r.depSum);
  // daily trend
  const span=[]; for(let d=new Date(range.start); d<range.end; d.setDate(d.getDate()+1)){ span.push(new Date(d)); }
  const dailyDep=span.map(d=> (TX||[]).filter(r=>{ const t=parseThaiDate(r['วันที่']); return t && t.getFullYear()===d.getFullYear() && t.getMonth()===d.getMonth() && t.getDate()===d.getDate() && r['รายการ']==='ฝาก'; }).reduce((a,b)=>a+toNumber(b['จำนวนเงิน']),0));
  if(barChart) barChart.destroy(); if(lineChart) lineChart.destroy();
  barChart = new Chart(ctx1,{type:'bar',data:{labels,datasets:[{label:'จำนวนครั้งฝาก (Top 10)',data:depCounts},{label:'ยอดฝากรวม (บาท)',data:depSums}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});
  lineChart = new Chart(ctx2,{type:'line',data:{labels:span.map(d=>d.toLocaleDateString('th-TH',{month:'short',day:'numeric'})),datasets:[{label:'ยอดฝากรายวัน (บาท)',data:dailyDep}]} ,options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});
}

// Share leaderboard via LINE
async function shareLeaderboard(){
  try{ if(typeof liff!=='undefined'){ try{ await liff.init({liffId:LIFF_ID}); }catch(e){} if(!liff.isLoggedIn()){ await Swal.fire({title:'ต้องเข้าสู่ระบบ LINE',text:'เพื่อแชร์ลีดเดอร์บอร์ด',icon:'info',confirmButtonText:'เข้าสู่ระบบ'}); liff.login({redirectUri:location.href}); return; } } }catch(e){}
  const modeBtn = document.querySelector('[data-lb].active') || document.querySelector('[data-lb="week"]'); const mode=modeBtn? modeBtn.getAttribute('data-lb') : 'week';
  const {rows}=leaderboardData(mode);
  const headers=['อันดับ','บัญชี','ชั้น','ครั้งฝาก','ยอดรวม'];
  const headerBox={type:'box',layout:'horizontal',contents:headers.map(h=>({type:'text',text:h,size:'xs',weight:'bold',align:'center',flex:1}))};
  const dataBoxes=rows.slice(0,10).map((r,i)=>({type:'box',layout:'horizontal',backgroundColor: i%2? '#FFFFFF':'#F5F6FA',contents:[
    {type:'text',text:String(i+1),size:'xs',align:'center',flex:1},
    {type:'text',text:formatAccountMasked(r.acc),size:'xs',align:'center',flex:2},
    {type:'text',text:r.cls,size:'xs',align:'center',flex:1},
    {type:'text',text:String(r.depCount),size:'xs',align:'center',flex:1},
    {type:'text',text:fmtNumber(r.depSum),size:'xs',align:'center',flex:2},
  ]}));
  const bubble={type:'bubble',size:'giga',body:{type:'box',layout:'vertical',contents:[
    {type:'text',text:'WDBank • ลีดเดอร์บอร์ด ('+mode+')',weight:'bold',size:'lg'},
    {type:'text',text:'วันที่ '+thaiDateString(),color:'#7286D3',size:'sm'},
    {type:'separator',margin:'md'}, headerBox, {type:'separator',margin:'sm'},
    {type:'box',layout:'vertical',margin:'md',spacing:'sm',contents:dataBoxes}
  ]},
  footer:{type:'box',layout:'vertical',spacing:'sm',contents:[{type:'button',style:'primary',action:{type:'uri',label:'เปิด WDBank (LIFF)',uri:'https://liff.line.me/'+LIFF_ID}}]}};
  try{ await liff.shareTargetPicker([{type:'flex',altText:'WDBank • ลีดเดอร์บอร์ด',contents:bubble}]); if(liff.closeWindow) liff.closeWindow(); }catch(e){ console.warn('shareLeaderboard error', e); }
}

// Report Hub PDF
async function exportReportHubPDF(){
  try{
    const { jsPDF } = window.jspdf||{}; if(!jsPDF) return Swal.fire('ไม่พบ jsPDF');
    const doc=new jsPDF({unit:'pt',format:'a4'});
    doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.text('WDBank • Report Hub',40,40);
    doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.text(thaiDateString(),40,60);
    const bar=$id('barOverall'); const line=$id('lineTrend');
    if(bar){ const img=bar.toDataURL('image/png',1.0); doc.addImage(img,'PNG',40,80,515,220); }
    if(line){ const img2=line.toDataURL('image/png',1.0); doc.addImage(img2,'PNG',40,320,515,220); }
    doc.save('wdbank-report-hub.pdf');
  }catch(e){ console.warn('exportReportHubPDF', e); }
}

// Bindings
document.addEventListener('DOMContentLoaded', async ()=>{
  // Home
  setMiniTip();
  renderHomeCards();

  // Leaderboard & Report Hub default week
  await ensureTX();
  function markActive(selector, attr, val){ document.querySelectorAll(selector).forEach(b=> b.classList.toggle('active', b.getAttribute(attr)===val)); }
  renderLeaderboard('week'); setCharts('week'); markActive('[data-lb]','data-lb','week');
  document.querySelectorAll('[data-lb]').forEach(btn=> btn.addEventListener('click', ()=>{ const mode=btn.getAttribute('data-lb'); renderLeaderboard(mode); setCharts(mode); markActive('[data-lb]','data-lb',mode); }));
  document.querySelectorAll('[data-rg]').forEach(btn=> btn.addEventListener('click', ()=>{ const mode=btn.getAttribute('data-rg'); setCharts(mode); }));
  $id('share-leaderboard')?.addEventListener('click', shareLeaderboard);
  $id('dl-reporthub-pdf')?.addEventListener('click', exportReportHubPDF);

  // Bottom nav
  document.querySelectorAll('.nav-btn').forEach(b=> b.addEventListener('click', ()=>{
    const v=b.dataset.view; document.querySelectorAll('.nav-btn').forEach(n=>n.classList.remove('active')); b.classList.add('active');
    document.querySelectorAll('.view').forEach(vw=>vw.classList.remove('show')); $id('view-'+v)?.classList.add('show');
  }));
});
