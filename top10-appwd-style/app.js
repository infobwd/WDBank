const LIFF_ID = "";
const SHEET_TX = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortรายการฝากและถอน';

if (typeof window.$id === 'undefined') {
  window.$id = (id)=>document.getElementById(id);
  window.setText = (id, t)=>{ const el=$id(id); if(el) el.textContent=t; };
  window.setHTML = (id, h)=>{ const el=$id(id); if(el) el.innerHTML=h; };
  window.setSrc = (id, u)=>{ const el=$id(id); if(el) el.src=u; };
  window.thaiDateString = (d)=>{ if(!d) d=new Date(); return d.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}); };
  window.parseThaiDate = (s)=>{ try{ s=String(s); const [datePart, timePart='00:00:00']=s.split(',').map(x=>x.trim()); const [dd,mm,yy]=datePart.split('/').map(n=>parseInt(n,10)); const [HH,MM,SS]=timePart.split(':').map(n=>parseInt(n,10)); const gy=(yy>2400? yy-543:yy); return new Date(gy,(mm||1)-1,dd||1,HH||0,MM||0,SS||0); }catch(e){ return null; } };
  window.monthRange = (date)=>{ const s=new Date(date.getFullYear(), date.getMonth(), 1,0,0,0,0); const e=new Date(date.getFullYear(), date.getMonth()+1, 1,0,0,0,0); return {start:s,end:e}; };
  window.prevMonth = (date)=> new Date(date.getFullYear(), date.getMonth()-1, 1);
  window.inRange = (d,s,e)=> d && d>=s && d<e;
  window.toNumber = (v)=> Number(String(v??'').replace(/[, ]/g,''));
  window.fmtNumber = (v)=>{ const n=toNumber(v); return isFinite(n)? n.toLocaleString('th-TH', {maximumFractionDigits:2}) : String(v??''); };
  window.formatAccountMasked = (val)=>{ const raw=String(val??'').replace(/[ ,]/g,''); if(!raw) return '-'; return raw.slice(0,4)+' \u2022\u2022'; };
}

window.TX = window.TX || [];
window.MINI_TIPS = window.MINI_TIPS || [
  'ออมเล็ก ๆ แต่บ่อย ๆ ดีต่อวินัยมากกว่าครั้งละก้อนใหญ่ 💪',
  'ตั้งเวลาออมประจำ เช่น จันทร์/พฤ. หลังเข้าแถว 5 นาที ⏰',
  'ตั้งเป้าหมายสั้น ๆ รายสัปดาห์ จะเห็นความก้าวหน้าเร็วขึ้น ✨',
  'ออมก่อนใช้: แยกเงินออมทันทีที่ได้รับเงิน 💼',
  'ชวนเพื่อนทั้งห้องออมพร้อมกัน สนุกและมีแรงใจขึ้น 🤝'
];

function setMiniTip(){
  const el=$id('miniTip'); if(!el) return;
  const idx=Math.floor(Date.now()/86400000)%MINI_TIPS.length;
  el.textContent = MINI_TIPS[idx];
  el.classList.remove('sk','sk-title');
}

async function fetchJSON(url){
  const res = await fetch(url+(url.includes('?')?'&':'?')+'_ts='+Date.now(), {cache:'no-store'});
  if(!res.ok) throw new Error(res.statusText);
  return res.json();
}

async function ensureTX(){
  if(Array.isArray(window.TX) && window.TX.length) return window.TX;
  try{ const data = await fetchJSON(SHEET_TX); window.TX = data; return data; }catch(e){ console.warn('fetch TX failed', e); return []; }
}

function renderWeeklyKPIs(){
  const tx = window.TX||[];
  const d=new Date(); const day=(d.getDay()+6)%7;
  const start=new Date(d); start.setDate(d.getDate()-day); start.setHours(0,0,0,0);
  const end=new Date(start); end.setDate(start.getDate()+7);
  let depC=0,wdrC=0,depS=0,wdrS=0;
  tx.forEach(r=>{
    const dd=parseThaiDate(r['วันที่']); if(!inRange(dd,start,end)) return;
    const act=String(r['รายการ']||''); const amt=toNumber(r['จำนวนเงิน']);
    if(act==='ฝาก'){ depC++; depS+=amt||0; }
    if(act==='ถอน'){ wdrC++; wdrS+=amt||0; }
  });
  setText('kpiDepCount', depC.toLocaleString('th-TH'));
  setText('kpiWdrCount', wdrC.toLocaleString('th-TH'));
  setText('kpiDepSum', depS.toLocaleString('th-TH'));
  setText('kpiWdrSum', wdrS.toLocaleString('th-TH'));
  ['kpiDepCount','kpiWdrCount','kpiDepSum','kpiWdrSum'].forEach(id=>$id(id)?.classList.remove('sk','sk-title'));
}

function avgDepositCountPerActiveAccount(txArr, start, end){
  const perClassAcc = new Map();
  (txArr||[]).forEach(r=>{
    if(String(r['รายการ']||'')!=='ฝาก') return;
    const d=parseThaiDate(r['วันที่']); if(!inRange(d,start,end)) return;
    const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(!acc) return;
    const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ');
    const clsMap=perClassAcc.get(cls)||new Map();
    clsMap.set(acc,(clsMap.get(acc)||0)+1);
    perClassAcc.set(cls,clsMap);
  });
  const out=[];
  for(const [cls, mp] of perClassAcc.entries()){
    const counts=[...mp.values()];
    const avg=counts.reduce((a,b)=>a+b,0)/Math.max(counts.length,1);
    out.push({ชั้น:cls, avg});
  }
  out.sort((a,b)=> a.ชั้น.localeCompare(b.ชั้น,'th'));
  return out;
}

function renderMonthlyAverages(){
  const now=new Date();
  const {start:curStart,end:curEnd}=monthRange(now);
  const {start:prvStart,end:prvEnd}=monthRange(prevMonth(now));
  const tx=window.TX||[];
  const mapNow=new Map(), mapPrev=new Map();
  (tx||[]).forEach(r=>{
    if(String(r['รายการ']||'')!=='ฝาก') return;
    const d=parseThaiDate(r['วันที่']); const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(!acc) return;
    if(inRange(d,curStart,curEnd)) mapNow.set(acc,(mapNow.get(acc)||0)+1);
    if(inRange(d,prvStart,prvEnd)) mapPrev.set(acc,(mapPrev.get(acc)||0)+1);
  });
  const avgThis = mapNow.size? (Array.from(mapNow.values()).reduce((a,b)=>a+b,0)/mapNow.size) : 0;
  const avgPrev = mapPrev.size? (Array.from(mapPrev.values()).reduce((a,b)=>a+b,0)/mapPrev.size) : 0;
  setText('avgThisMonth', isFinite(avgThis)? avgThis.toFixed(2):'-');
  setText('avgPrevMonth', isFinite(avgPrev)? avgPrev.toFixed(2):'-');
  const pct = (avgPrev>0)? ((avgThis-avgPrev)/avgPrev*100):0;
  setText('deltaPct', (pct>=0?'+':'')+pct.toFixed(0)+'%');
  ['avgThisMonth','avgPrevMonth','deltaPct'].forEach(id=>$id(id)?.classList.remove('sk','sk-title'));

  const perNow = avgDepositCountPerActiveAccount(tx, curStart, curEnd);
  const perPrev= avgDepositCountPerActiveAccount(tx, prvStart, prvEnd);
  const prevBy = new Map(perPrev.map(x=>[x.ชั้น, x.avg]));
  const body = $id('avg-by-class-body');
  if(body){
    body.innerHTML='';
    perNow.forEach(row=>{
      const p = prevBy.get(row.ชั้น) || 0;
      const delta = p>0? ((row.avg-p)/p*100):0;
      const tr=document.createElement('tr');
      tr.innerHTML = `<td>${row.ชั้น}</td><td>${row.avg.toFixed(2)}</td><td>${p.toFixed(2)}</td><td>${(delta>=0?'+':'')}${delta.toFixed(0)}%</td>`;
      body.appendChild(tr);
    });
    document.querySelectorAll('#avg-by-class-body .sk')?.forEach(el=>el.classList.remove('sk','sk-text'));
  }
}

function weekRange(date){ const d=new Date(date); const day=(d.getDay()+6)%7; const start=new Date(d); start.setDate(d.getDate()-day); start.setHours(0,0,0,0); const end=new Date(start); end.setDate(start.getDate()+7); return {start,end}; }
function currentTermRange(){
  const txArr = window.TX||[]; let latest=null;
  txArr.forEach(r=>{
    const s=String(r['ปีการศึกษา']||'').trim();
    const m=s.match(/^([12])\/(\d{4})$/);
    if(m){ const t=+m[1], y=+m[2]; if(!latest || y>latest.y || (y===latest.y && t>latest.t)){ latest={t,y}; } }
  });
  if(latest){
    const y = latest.y>2400? latest.y-543: latest.y;
    if(latest.t===1){ return { start:new Date(y,4,1), end:new Date(y,10,1) }; }
    else{ return { start:new Date(y,10,1), end:new Date(y+1,4,30,23,59,59,999) }; }
  }
  return monthRange(new Date());
}

function filterByRange(arr, keyDate, range){
  return (arr||[]).filter(r=>{
    const d=parseThaiDate(r[keyDate]); return inRange(d, range.start, range.end);
  });
}

function leaderboardData(mode){
  const txArr = window.TX||[];
  let range; if(mode==='week') range=weekRange(new Date()); else if(mode==='month') range=monthRange(new Date()); else range=currentTermRange();
  const sample = filterByRange(txArr, 'วันที่', range);
  const perAcc = new Map();
  sample.forEach(r=>{
    const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(!acc) return;
    const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ');
    const act=String(r['รายการ']||''); const amt=toNumber(r['จำนวนเงิน']);
    const node=perAcc.get(acc)||{depCount:0,depSum:0,cls};
    if(act==='ฝาก'){ node.depCount += 1; node.depSum += isFinite(amt)? amt:0; }
    perAcc.set(acc, node);
  });
  const counts = [...perAcc.values()].map(v=>v.depCount).filter(v=>v>0);
  const baseline = counts.length? (counts.reduce((a,b)=>a+b,0)/counts.length) : 0;
  const rows = [...perAcc.entries()].map(([acc,info])=>{
    const score = info.depCount + (info.depCount>=baseline? 0.5:0);
    return { acc, cls: info.cls, depCount: info.depCount, depSum: info.depSum, score, baseline };
  }).filter(r=>r.depCount>0);
  rows.sort((a,b)=> b.score - a.score || b.depCount - a.depCount || b.depSum - a.depSum);
  return {rows, baseline, range};
}

function mask(acc){ return formatAccountMasked(acc); }

function renderLeaderboard(mode){
  const {rows, baseline} = leaderboardData(mode);
  const grid = $id('lb-grid'); if(!grid) return;
  grid.innerHTML = '';
  rows.slice(0,10).forEach((r,i)=>{
    const div=document.createElement('div');
    div.className='lb-card';
    div.innerHTML = '<div class="lb-rank">'+(i+1)+'</div>' +
      '<div class="lb-body"><div class="lb-name">'+ mask(r.acc) +'</div>' +
      '<div class="lb-sub">ชั้น '+ r.cls +' • ฝาก '+ r.depCount +' ครั้ง • '+ fmtNumber(r.depSum) +' บาท</div></div>';
    grid.appendChild(div);
  });
  setText('lb-desc', 'เกณฑ์อ้างอิง (ฝากเฉลี่ยต่อบัญชี) = ' + (baseline? baseline.toFixed(2): '0'));
}

let barChart, lineChart;
function setCharts(mode){
  const {rows, range} = leaderboardData(mode);
  const ctx1 = $id('barOverall')?.getContext('2d');
  const ctx2 = $id('lineTrend')?.getContext('2d');
  if(!ctx1 || !ctx2) return;
  const top = rows.slice(0,10);
  const labels = top.map(r=>mask(r.acc));
  const depCounts = top.map(r=>r.depCount);
  const depSums = top.map(r=>r.depSum);
  const txArr = window.TX||[];
  const span = []; const d0 = new Date(range.start); const d1 = new Date(range.end);
  for(let d=new Date(d0); d<d1; d.setDate(d.getDate()+1)){ span.push(new Date(d)); }
  const dailyDep = span.map(d=>{
    const dayTx = (txArr||[]).filter(r=>{
      const t=parseThaiDate(r['วันที่']); return t && t.getFullYear()===d.getFullYear() && t.getMonth()===d.getMonth() && t.getDate()===d.getDate() && r['รายการ']==='ฝาก';
    });
    return dayTx.reduce((a,b)=> a + toNumber(b['จำนวนเงิน']), 0);
  });
  if(barChart) barChart.destroy();
  if(lineChart) lineChart.destroy();
  barChart = new Chart(ctx1, { type:'bar', data:{ labels, datasets:[ {label:'จำนวนครั้งฝาก (Top 10)', data:depCounts}, {label:'ยอดฝากรวม (บาท)', data:depSums} ] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}} } });
  lineChart = new Chart(ctx2, { type:'line', data:{ labels: span.map(d=> d.toLocaleDateString('th-TH',{month:'short', day:'numeric'})), datasets:[ {label:'ยอดฝากรายวัน (บาท)', data:dailyDep} ] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}} } });
}

async function shareLeaderboard(){
  try{ if(typeof liff!=='undefined'){ try{ await liff.init({liffId:LIFF_ID}); }catch(e){} if(!liff.isLoggedIn()){ await Swal.fire({title:'ต้องเข้าสู่ระบบ LINE',text:'เพื่อแชร์ลีดเดอร์บอร์ด',icon:'info',confirmButtonText:'เข้าสู่ระบบ'}); liff.login({redirectUri:location.href}); return; } } }catch(e){}
  const modeBtn = document.querySelector('[data-lb].active') || document.querySelector('[data-lb="week"]');
  const mode = modeBtn ? modeBtn.getAttribute('data-lb') : 'week';
  const {rows} = leaderboardData(mode);
  const headers=['อันดับ','บัญชี','ชั้น','ครั้งฝาก','ยอดรวม'];
  const headerBox={type:'box',layout:'horizontal',contents:headers.map(h=>({type:'text',text:h,size:'xs',weight:'bold',align:'center',flex:1}))};
  const dataBoxes = rows.slice(0,10).map((r,i)=>({type:'box',layout:'horizontal',backgroundColor: i%2? '#FFFFFF':'#F5F6FA',contents:[
    {type:'text',text:String(i+1),size:'xs',align:'center',flex:1},
    {type:'text',text:mask(r.acc),size:'xs',align:'center',flex:2},
    {type:'text',text:r.cls,size:'xs',align:'center',flex:1},
    {type:'text',text:String(r.depCount),size:'xs',align:'center',flex:1},
    {type:'text',text:fmtNumber(r.depSum),size:'xs',align:'center',flex:2},
  ]}));
  const bubble={type:'bubble',size:'giga',body:{type:'box',layout:'vertical',contents:[
    {type:'text',text:'WDBank • ลีดเดอร์บอร์ด ('+mode+')',weight:'bold',size:'lg'},
    {type:'text',text:thaiDateString(),color:'#7286D3',size:'sm'},
    {type:'separator',margin:'md'}, headerBox, {type:'separator',margin:'sm'},
    {type:'box',layout:'vertical',margin:'md',spacing:'sm',contents:dataBoxes}
  ]},
  footer:{type:'box',layout:'vertical',spacing:'sm',contents:[{type:'button',style:'primary',action:{type:'uri',label:'เปิด WDBank (LIFF)',uri:'https://liff.line.me/'+LIFF_ID}}]}};
  try{ await liff.shareTargetPicker([{type:'flex',altText:'WDBank • ลีดเดอร์บอร์ด',contents:bubble}]); if(liff.closeWindow) liff.closeWindow(); }catch(e){ console.warn('shareLeaderboard error', e); }
}

async function exportReportHubPDF(){
  try{
    const { jsPDF } = window.jspdf || {};
    if(!jsPDF) return Swal.fire('ไม่พบ jsPDF');
    const doc = new jsPDF({unit:'pt', format:'a4'});
    const title = 'WDBank • Report Hub';
    doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.text(title, 40, 40);
    doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.text(thaiDateString(), 40, 60);
    const bar = $id('barOverall'); const line = $id('lineTrend');
    if(bar){ const img = bar.toDataURL('image/png', 1.0); doc.addImage(img, 'PNG', 40, 80, 515, 220); }
    if(line){ const img2 = line.toDataURL('image/png', 1.0); doc.addImage(img2, 'PNG', 40, 320, 515, 220); }
    doc.save('wdbank-report-hub.pdf');
  }catch(e){ console.warn('exportReportHubPDF', e); }
}

function showView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('show'));
  const target=$id(`view-${name}`); if(target) target.classList.add('show');
  document.querySelectorAll('.nav-btn').forEach(b=> b.classList.toggle('active', b.dataset.view===name));
  if(name==='leaderboard'){ renderLeaderboard('week'); setCharts('week'); markActive('[data-lb]','data-lb','week'); }
}
function markActive(selector, attr, val){
  document.querySelectorAll(selector).forEach(b=> b.classList.toggle('active', b.getAttribute(attr)===val));
}

document.addEventListener('DOMContentLoaded', async ()=>{
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn=>{
    btn.addEventListener('click', ()=> showView(btn.getAttribute('data-view')) );
  });
  document.querySelectorAll('[data-lb]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const mode=btn.getAttribute('data-lb');
      renderLeaderboard(mode); setCharts(mode); markActive('[data-lb]','data-lb',mode);
    });
  });
  document.querySelectorAll('[data-rg]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const mode=btn.getAttribute('data-rg');
      setCharts(mode); markActive('[data-rg]','data-rg',mode);
    });
  });
  $id('share-leaderboard')?.addEventListener('click', shareLeaderboard);
  $id('dl-reporthub-pdf')?.addEventListener('click', exportReportHubPDF);

  try{ await liff.init({liffId:LIFF_ID}); }catch(e){}
  if(typeof liff!=='undefined' && liff.isLoggedIn()){
    try{ const p=await liff.getProfile(); ($id('avatar')||{}).src = p?.pictureUrl || './assets/avatar.svg'; const lb=$id('loginBadge'); if(lb){ lb.textContent='เข้าสู่ระบบแล้ว'; lb.classList.remove('show'); } }catch(e){}
  }else{ $id('loginBadge')?.classList.add('show'); }

  await ensureTX();
  setMiniTip();
  renderWeeklyKPIs();
  renderMonthlyAverages();
  renderLeaderboard('week'); setCharts('week'); markActive('[data-lb]','data-lb','week');
});
