const LIFF_ID='2005230346-2OVa774O';
const SHEET_TX='https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortรายการฝากและถอน';
let TX=[];

function $id(id){return document.getElementById(id);} 
function setText(id,t){const el=$id(id); if(el) el.textContent=t;}
function setSrc(id,u){const el=$id(id); if(el) el.src=u;}
function thaiDateString(d){ if(!d) d=new Date(); return d.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}); }
function parseThaiDate(s){ try{ s=String(s); const [datePart,timePart='00:00:00']=s.split(',').map(x=>x.trim()); const [d,m,y]=datePart.split('/').map(n=>parseInt(n,10)); const [hh,mm,ss]=timePart.split(':').map(n=>parseInt(n,10)); const gy=(y>2400? y-543:y); return new Date(gy,m-1,d,hh||0,mm||0,ss||0);}catch(e){return null;} }
function inRange(d,s,e){ return d && d>=s && d<e; }
function monthRange(date){ const start=new Date(date.getFullYear(),date.getMonth(),1,0,0,0,0); const end=new Date(date.getFullYear(),date.getMonth()+1,1,0,0,0,0); return {start,end}; }
function prevMonth(date){ return new Date(date.getFullYear(), date.getMonth()-1, 1); }
function toNumber(x){ return Number(String(x||'').replace(/[, ]/g,'')); }
function fmtNumber(x){ const n=toNumber(x); return isFinite(n)? n.toLocaleString('th-TH') : String(x||''); }
function mask(acc){ const raw=String(acc||'').replace(/[ ,]/g,''); if(!raw) return '-'; return raw.slice(0,4)+' \u2022\u2022'; }

async function fetchJSON(url){ const res=await fetch(url+(url.includes('?')?'&':'?')+'_ts='+Date.now(),{cache:'no-store'}); if(!res.ok) throw new Error(res.statusText); return res.json(); }

// Mini Tips
const MINI_TIPS=['ออมเล็กๆ แต่บ่อยๆ ดีต่อวินัย 💪','ตั้งเวลาออมประจำ จ/พฤ 07:30 ⏰','ตั้งเป้าหมายสั้นรายสัปดาห์ ✨','ออมก่อนใช้ แยกทันทีที่ได้รับเงิน 💼','ชวนเพื่อนทั้งห้องออมพร้อมกัน 🤝'];
function setMiniTip(){ const el=$id('miniTip'); if(!el) return; const idx=Math.floor(Date.now()/86400000)%MINI_TIPS.length; el.textContent=MINI_TIPS[idx]; el.classList.remove('sk','sk-title'); }
$id('btnNextTip')?.addEventListener('click', ()=>{ const el=$id('miniTip'); if(el) el.textContent = MINI_TIPS[Math.floor(Math.random()*MINI_TIPS.length)]; });

// Monthly Delta using sheet TX (current vs previous month)
function computeMonthlyDeltaCard(){
  (async()=>{
    try{
      let txArr = (TX && TX.length)? TX : await fetchJSON(SHEET_TX);
      const now=new Date(); const cur=monthRange(now); const prev=monthRange(prevMonth(now));
      const mapNow=new Map(), mapPrev=new Map();
      (txArr||[]).forEach(r=>{
        const d=parseThaiDate(r['วันที่']); if(!d) return;
        const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(!acc) return;
        if(r['รายการ']==='ฝาก'){
          if(inRange(d,cur.start,cur.end)) mapNow.set(acc,(mapNow.get(acc)||0)+1);
          if(inRange(d,prev.start,prev.end)) mapPrev.set(acc,(mapPrev.get(acc)||0)+1);
        }
      });
      const avgNow=[...mapNow.values()].reduce((a,b)=>a+b,0)/Math.max(mapNow.size,1);
      const avgPrev=[...mapPrev.values()].reduce((a,b)=>a+b,0)/Math.max(mapPrev.size,1);
      const pct=(avgPrev>0)? ((avgNow-avgPrev)/avgPrev*100):0;
      setText('deltaPct',(pct>=0?'+':'')+pct.toFixed(0)+'%');
      setText('avgThisMonth', isFinite(avgNow)? avgNow.toFixed(2):'-');
      setText('avgBaseline',  isFinite(avgPrev)? avgPrev.toFixed(2):'—');
      ['deltaPct','avgThisMonth','avgBaseline'].forEach(id=>$id(id)?.classList.remove('sk','sk-title'));
    }catch(e){ console.warn('computeMonthlyDeltaCard error', e); }
  })();
}

// Leaderboard & Report Hub
function weekRange(date){ const d=new Date(date); const day=(d.getDay()+6)%7; const start=new Date(d); start.setDate(d.getDate()-day); start.setHours(0,0,0,0); const end=new Date(start); end.setDate(start.getDate()+7); return {start,end}; }
function currentTermRange(){
  const txArr = TX||[];
  let latest=null;
  txArr.forEach(r=>{ const s=String(r['ปีการศึกษา']||'').trim(); const m=s.match(/^([12])\/(\d{4,4})$/); if(m){ const t=+m[1], y=+m[2]; if(!latest || y>latest.y || (y===latest.y && t>latest.t)){ latest={t,y}; } } });
  if(latest){ const y = latest.y>2400? latest.y-543: latest.y; if(latest.t===1) return {start:new Date(y,4,1), end:new Date(y,10,1)}; return {start:new Date(y,10,1), end:new Date(y+1,4,30,23,59,59,999)}; }
  return monthRange(new Date());
}
function filterByRange(arr, keyDate, range){ return (arr||[]).filter(r=>{ const d=parseThaiDate(r[keyDate]); return inRange(d, range.start, range.end); }); }
function leaderboardData(mode){
  const txArr = TX||[];
  let range = mode==='week'? weekRange(new Date()) : mode==='month'? monthRange(new Date()) : currentTermRange();
  const sample = filterByRange(txArr, 'วันที่', range);
  const perAcc = new Map();
  sample.forEach(r=>{ const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(!acc) return; const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ'); const act=String(r['รายการ']||''); const amt=toNumber(r['จำนวนเงิน']); const node=perAcc.get(acc)||{depCount:0,depSum:0,cls}; if(act==='ฝาก'){ node.depCount += 1; node.depSum += isFinite(amt)? amt:0; } perAcc.set(acc, node); });
  const counts = [...perAcc.values()].map(v=>v.depCount).filter(v=>v>0);
  const baseline = counts.length? (counts.reduce((a,b)=>a+b,0)/counts.length) : 0;
  const rows = [...perAcc.entries()].map(([acc,info])=>{ const score = info.depCount + (info.depCount>=baseline? 0.5:0); return { acc, cls:info.cls, depCount:info.depCount, depSum:info.depSum, score, baseline }; }).filter(r=>r.depCount>0);
  rows.sort((a,b)=> b.score - a.score || b.depCount - a.depCount || b.depSum - a.depSum);
  return {rows, baseline, range};
}
function renderLeaderboard(mode){
  const {rows, baseline} = leaderboardData(mode);
  const grid = $id('lb-grid'); if(!grid) return;
  grid.innerHTML='';
  rows.slice(0,10).forEach((r,i)=>{ const div=document.createElement('div'); div.className='lb-card'; div.innerHTML='<div class="lb-rank">'+(i+1)+'</div><div class="lb-body"><div class="lb-name">'+mask(r.acc)+'</div><div class="lb-sub">ชั้น '+r.cls+' • ฝาก '+r.depCount+' ครั้ง • '+fmtNumber(r.depSum)+' บาท</div></div>'; grid.appendChild(div); });
  setText('lb-desc','เกณฑ์อ้างอิง (ฝากเฉลี่ยต่อบัญชี) = ' + (baseline? baseline.toFixed(2): '0'));
}
let barChart, lineChart;
function setCharts(mode){
  const {rows, range} = leaderboardData(mode);
  const ctx1=$id('barOverall')?.getContext('2d'), ctx2=$id('lineTrend')?.getContext('2d'); if(!ctx1||!ctx2) return;
  const top=rows.slice(0,10); const labels=top.map(r=>mask(r.acc)); const depCounts=top.map(r=>r.depCount); const depSums=top.map(r=>r.depSum);
  const span=[]; const d0=new Date(range.start), d1=new Date(range.end); for(let d=new Date(d0); d<d1; d.setDate(d.getDate()+1)){ span.push(new Date(d)); }
  const dailyDep=span.map(d=>{ const dayTx=(TX||[]).filter(r=>{ const t=parseThaiDate(r['วันที่']); return t && t.getFullYear()===d.getFullYear() && t.getMonth()===d.getMonth() && t.getDate()===d.getDate() && r['รายการ']==='ฝาก'; }); return dayTx.reduce((a,b)=> a+toNumber(b['จำนวนเงิน']),0); });
  if(barChart) barChart.destroy(); if(lineChart) lineChart.destroy();
  barChart=new Chart(ctx1,{type:'bar',data:{labels,datasets:[{label:'จำนวนครั้งฝาก (Top 10)',data:depCounts},{label:'ยอดฝากรวม (บาท)',data:depSums}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});
  lineChart=new Chart(ctx2,{type:'line',data:{labels:span.map(d=>d.toLocaleDateString('th-TH',{month:'short',day:'numeric'})),datasets:[{label:'ยอดฝากรายวัน (บาท)',data:dailyDep} ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});
}

// Share Leaderboard
async function shareLeaderboard(){ try{ await liff.init({liffId:LIFF_ID}); }catch(e){} if(!liff.isLoggedIn()){ await Swal.fire({title:'ต้องเข้าสู่ระบบ LINE',text:'เพื่อแชร์ลีดเดอร์บอร์ด',icon:'info',confirmButtonText:'เข้าสู่ระบบ'}); liff.login({redirectUri:location.href}); return; }
  const modeBtn=document.querySelector('[data-lb].active')||document.querySelector('[data-lb="week"]'); const mode=modeBtn?modeBtn.getAttribute('data-lb'):'week';
  const {rows}=leaderboardData(mode);
  const headers=['อันดับ','บัญชี','ชั้น','ครั้งฝาก','ยอดรวม']; const headerBox={type:'box',layout:'horizontal',contents:headers.map(h=>({type:'text',text:h,size:'xs',weight:'bold',align:'center',flex:1}))};
  const dataBoxes=rows.slice(0,10).map((r,i)=>({type:'box',layout:'horizontal',backgroundColor: i%2? '#FFFFFF':'#F5F6FA',contents:[
    {type:'text',text:String(i+1),size:'xs',align:'center',flex:1},
    {type:'text',text:mask(r.acc),size:'xs',align:'center',flex:2},
    {type:'text',text:r.cls,size:'xs',align:'center',flex:1},
    {type:'text',text:String(r.depCount),size:'xs',align:'center',flex:1},
    {type:'text',text:fmtNumber(r.depSum),size:'xs',align:'center',flex:2},
  ]}));
  const bubble={type:'bubble',size:'giga',body:{type:'box',layout:'vertical',contents:[
    {type:'text',text:'WDBank • ลีดเดอร์บอร์ด ('+mode+')',weight:'bold',size:'lg'},
    {type:'text',text:'ปีการศึกษา: '+ (window.latestTermFromTX? (latestTermFromTX()||'-'):'-') +' • '+ thaiDateString(),color:'#7286D3',size:'sm'},
    {type:'separator',margin:'md'}, headerBox, {type:'separator',margin:'sm'},
    {type:'box',layout:'vertical',margin:'md',spacing:'sm',contents:dataBoxes}
  ]},
  footer:{type:'box',layout:'vertical',spacing:'sm',contents:[{type:'button',style:'primary',action:{type:'uri',label:'เปิด WDBank (LIFF)',uri:'https://liff.line.me/'+LIFF_ID}}]}};
  try{ await liff.shareTargetPicker([{type:'flex',altText:'WDBank • ลีดเดอร์บอร์ด',contents:bubble}]); if(liff.closeWindow) liff.closeWindow(); }catch(e){ console.warn('shareLeaderboard error', e); }
}

// Report Hub PDF
async function exportReportHubPDF(){ try{ const { jsPDF } = window.jspdf || {}; if(!jsPDF) return Swal.fire('ไม่พบ jsPDF'); const doc=new jsPDF({unit:'pt',format:'a4'}); doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.text('WDBank • Report Hub',40,40); doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.text(thaiDateString(), 40, 60); const bar=$id('barOverall'), line=$id('lineTrend'); if(bar){ const img=bar.toDataURL('image/png',1.0); doc.addImage(img,'PNG',40,80,515,220);} if(line){ const img2=line.toDataURL('image/png',1.0); doc.addImage(img2,'PNG',40,320,515,220);} doc.save('wdbank-report-hub.pdf'); }catch(e){ console.warn('exportReportHubPDF', e);} }

// Nav & init
function markActive(selector, attr, val){ document.querySelectorAll(selector).forEach(b=> b.classList.toggle('active', b.getAttribute(attr)===val)); }
function switchView(view){ document.querySelectorAll('.nav-btn').forEach(n=>n.classList.toggle('active', n.dataset.view===view)); document.querySelectorAll('.view').forEach(v=>v.classList.remove('show')); const el=$id('view-'+view); if(el) el.classList.add('show'); }
document.querySelectorAll('.nav-btn[data-view]').forEach(btn=> btn.addEventListener('click', ()=> switchView(btn.dataset.view)));

document.querySelectorAll('[data-lb]').forEach(btn=> btn.addEventListener('click', ()=>{ const mode=btn.getAttribute('data-lb'); renderLeaderboard(mode); setCharts(mode); markActive('[data-lb]','data-lb',mode); }));
document.querySelectorAll('[data-rg]').forEach(btn=> btn.addEventListener('click', ()=>{ const mode=btn.getAttribute('data-rg'); setCharts(mode); markActive('[data-rg]','data-rg',mode); }));
$id('share-leaderboard')?.addEventListener('click', shareLeaderboard);
$id('dl-reporthub-pdf')?.addEventListener('click', exportReportHubPDF);

document.addEventListener('DOMContentLoaded', async ()=>{
  // load TX
  try{ TX = await fetchJSON(SHEET_TX); }catch(e){ console.warn(e); }
  // Home cards
  setMiniTip();
  computeMonthlyDeltaCard();
  // Leaderboard default: week
  renderLeaderboard('week'); setCharts('week'); markActive('[data-lb]','data-lb','week');
});


// Lazy render charts on entering Report view if canvases exist and not drawn yet
let __charts_inited = false;
function ensureCharts(mode){
  const bar = $id('barOverall'), line=$id('lineTrend');
  if(bar && line){
    setCharts(mode||'week');
    __charts_inited = true;
  }
}
document.querySelector('[data-view="report"]')?.addEventListener('click', ()=>{
  if(!__charts_inited) ensureCharts('week');
});


// ---- NAVBAR: view switching already exists via switchView()

// ---- SHARE VIEW bindings
$id('btnShareLeaderboard')?.addEventListener('click', ()=> shareLeaderboard());
$id('btnOpenLIFF')?.addEventListener('click', async ()=>{ try{ await liff.init({liffId:LIFF_ID}); if(!liff.isLoggedIn()){ liff.login({redirectUri:location.href}); } else { Swal.fire('เปิดสำเร็จ','LIFF พร้อมใช้งาน','success'); } }catch(e){ Swal.fire('เกิดข้อผิดพลาด', String(e), 'error'); } });

// ---- PROFILE VIEW: login/logout + load
async function loadProfile(){
  try{ await liff.init({liffId:LIFF_ID}); }catch(e){}
  if(typeof liff!=='undefined' && liff.isLoggedIn()){
    try{
      const p = await liff.getProfile();
      setText('prof-name', p?.displayName || '-');
      setText('prof-status', 'เข้าสู่ระบบแล้ว');
      setSrc('profileAvatar', p?.pictureUrl || './assets/avatar.svg');
      const lb=$id('loginBadge'); if(lb) lb.style.display='none';
      setSrc('avatar', p?.pictureUrl || './assets/avatar.svg');
    }catch(e){}
  }else{
    setText('prof-status', 'ยังไม่เข้าสู่ระบบ');
    const lb=$id('loginBadge'); if(lb) lb.style.display='inline-block';
    setSrc('profileAvatar', './assets/avatar.svg');
  }
}
$id('btnLogin')?.addEventListener('click', async ()=>{ try{ await liff.init({liffId:LIFF_ID}); liff.login({redirectUri:location.href}); }catch(e){} });
$id('btnLogout')?.addEventListener('click', async ()=>{ try{ await liff.init({liffId:LIFF_ID}); if(liff.isLoggedIn()){ await liff.logout(); location.reload(); } }catch(e){} });

document.querySelector('[data-view="profile"]')?.addEventListener('click', ()=> loadProfile());
document.addEventListener('DOMContentLoaded', ()=>{ loadProfile(); });
