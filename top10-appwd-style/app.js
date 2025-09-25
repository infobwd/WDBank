// ====== CONFIG ======
const LIFF_ID = 'YOUR_LIFF_ID'; // <-- ใส่ LIFF จริงของพี่
window.SHEET_TX = window.SHEET_TX || "https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortรายการฝากและถอน";

// ====== HELPERS ======
const $id = (id)=>document.getElementById(id);
const setText = (id, t)=>{ const el=$id(id); if(el) el.textContent=t; };
const setSrc = (id, u)=>{ const el=$id(id); if(el) el.src=u; };
const toNumber = (v)=> Number(String(v??'').replace(/[, ]/g,''));
const fmtNumber = (v)=>{ const n=toNumber(v); return isFinite(n)? n.toLocaleString('th-TH', {maximumFractionDigits:2}) : String(v??''); };
const formatAccountMasked = (val)=>{ const raw=String(val??'').replace(/[ ,]/g,''); if(!raw) return '-'; return raw.slice(0,4)+' \u2022\u2022'; };

function parseThaiDate(s){
  try{
    s=String(s);
    const [datePart, timePart='00:00:00']=s.split(',').map(x=>x.trim());
    const [dd,mm,yy]=datePart.split('/').map(n=>parseInt(n,10));
    const [HH,MM,SS]=timePart.split(':').map(n=>parseInt(n,10));
    const gy=(yy>2400? yy-543:yy);
    return new Date(gy, (mm||1)-1, dd||1, HH||0, MM||0, SS||0);
  }catch(e){ return null; }
}
function inRange(d,s,e){ return d && d>=s && d<e; }
function monthRange(date){ const s=new Date(date.getFullYear(), date.getMonth(), 1,0,0,0,0); const e=new Date(date.getFullYear(), date.getMonth()+1,1,0,0,0,0); return {start:s,end:e}; }
function prevMonth(date){ return new Date(date.getFullYear(), date.getMonth()-1, 1); }
function thaiDateString(d){ if(!d) d=new Date(); return d.toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'}); }
function thaiMonthRangeLabel(range){
  try{
    const s = new Date(range.start);
    const e = new Date(range.end); e.setDate(e.getDate()-1);
    if (s.getMonth()===e.getMonth() && s.getFullYear()===e.getFullYear()){
      const monthYear = e.toLocaleDateString('th-TH',{month:'short', year:'numeric'});
      return `${s.getDate()}–${e.getDate()} ${monthYear}`;
    }else{
      const S = s.toLocaleDateString('th-TH',{day:'numeric', month:'short'});
      const E = e.toLocaleDateString('th-TH',{day:'numeric', month:'short', year:'numeric'});
      return `${S} – ${E}`;
    }
  }catch(_){ return '-'; }
}

// ====== DATA LOADER ======
async function ensureTX(){
  try{
    if (Array.isArray(window.TX) && window.TX.length) return window.TX;
    const res = await fetch(window.SHEET_TX, { cache: "no-store" });
    const data = await res.json();
    window.TX = Array.isArray(data) ? data : [];
  }catch(e){
    console.warn("ensureTX error", e);
    window.TX = window.TX || [];
  }
  return window.TX;
}

// ====== MINI TIPS ======
const MINI_TIPS = [
  'ออมเล็ก ๆ แต่บ่อย ๆ ดีต่อวินัยมากกว่าครั้งละก้อนใหญ่ 💪',
  'ตั้งเวลาออมประจำ เช่น จันทร์/พฤ. หลังเข้าแถว 5 นาที ⏰',
  'ตั้งเป้าหมายสั้น ๆ รายสัปดาห์ จะเห็นความก้าวหน้าเร็วขึ้น ✨',
  'ออมก่อนใช้: แยกเงินออมทันทีที่ได้รับเงิน 💼',
  'ชวนเพื่อนทั้งห้องออมพร้อมกัน สนุกและมีแรงใจขึ้น 🤝'
];
function setMiniTip(){
  const el=$id('miniTip'); if(!el) return;
  const idx=Math.floor(Date.now()/86400000)%MINI_TIPS.length;
  el.textContent=MINI_TIPS[idx];
  el.classList.remove('sk','sk-title');
}
$id('btnNextTip')?.addEventListener('click', ()=>{
  const el=$id('miniTip');
  if(el) el.textContent = MINI_TIPS[Math.floor(Math.random()*MINI_TIPS.length)];
});

// ====== MONTHLY DELTA (school-wide) ======
function computeMonthlyDeltaCard(){
  try{
    const now=new Date(); 
    const curr=monthRange(now); 
    const prev=monthRange(prevMonth(now));
    // set ranges (Thai month short)
    setText('rangeThisMonth', thaiMonthRangeLabel(curr));
    setText('rangePrevMonth', thaiMonthRangeLabel(prev));

    const mapNow=new Map(), mapPrev=new Map();
    const txArr = (typeof TX!=='undefined' && Array.isArray(TX))? TX : (window.TX||[]);
    (txArr||[]).forEach(r=>{
      const d=parseThaiDate(r['วันที่']); if(!d) return;
      const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(!acc) return;
      if(String(r['รายการ']||'')==='ฝาก'){
        if(inRange(d,curr.start,curr.end)) mapNow.set(acc,(mapNow.get(acc)||0)+1);
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
}

// Tooltip
document.addEventListener('DOMContentLoaded', ()=>{
  $id('deltaInfo')?.addEventListener('click', ()=>{
    const html = [
      '<div style="text-align:left;line-height:1.6">',
      '<b>สูตรที่ใช้</b><br/>',
      '1) นับเฉพาะรายการ <b>“ฝาก”</b> ของเดือนนี้และเดือนก่อน<br/>',
      '2) หา <b>ค่าเฉลี่ยจำนวนครั้งฝากต่อบัญชี</b> ของแต่ละเดือน (เฉพาะบัญชีที่มีฝากในเดือนนั้น)<br/>',
      '3) เปอร์เซ็นต์เปลี่ยนแปลง = <code>((เฉลี่ยเดือนนี้ − ค่าเฉลี่ยอ้างอิง) / ค่าเฉลี่ยอ้างอิง) × 100</code>',
      '</div>'
    ].join('');
    if (typeof Swal!=='undefined' && Swal.fire){
      Swal.fire({title:'วิธีคำนวณ', html, icon:'info'});
    }else{
      alert('นับเฉพาะ “ฝาก”; เปอร์เซ็นต์ = ((เดือนนี้−เดือนก่อน)/เดือนก่อน)×100');
    }
  });
});

// ====== MONTHLY DELTA BY CLASS (Top 4) ======
function computeMonthlyDeltaByClass(){
  try{
    const txArr = (typeof TX!=='undefined' && Array.isArray(TX))? TX : (window.TX||[]);
    const now=new Date(); 
    const curr=monthRange(now); 
    const prev=monthRange(prevMonth(now));
    const mapClsNow=new Map(); // class -> Map(acc -> count)
    const mapClsPrev=new Map();

    function inc(map, cls, acc){
      const m = map.get(cls) || new Map();
      m.set(acc, (m.get(acc)||0)+1);
      map.set(cls, m);
    }

    (txArr||[]).forEach(r=>{
      if(String(r['รายการ']||'')!=='ฝาก') return;
      const d=parseThaiDate(r['วันที่']); if(!d) return;
      const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(!acc) return;
      const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ').trim();
      if(inRange(d, curr.start, curr.end)) inc(mapClsNow, cls, acc);
      if(inRange(d, prev.start, prev.end)) inc(mapClsPrev, cls, acc);
    });

    const classes = new Set([...mapClsNow.keys(), ...mapClsPrev.keys()]);
    const rows = [];
    classes.forEach(cls=>{
      const mN = mapClsNow.get(cls) || new Map();
      const mP = mapClsPrev.get(cls) || new Map();
      const avgNow = [...mN.values()].reduce((a,b)=>a+b,0) / Math.max(mN.size,1);
      const avgPrev = [...mP.values()].reduce((a,b)=>a+b,0) / Math.max(mP.size,1);
      const pct = (avgPrev>0)? ((avgNow-avgPrev)/avgPrev*100) : (avgNow>0? 100: 0);
      rows.push({cls, avgNow, avgPrev, pct});
    });

    rows.sort((a,b)=> b.pct - a.pct);
    const top = rows.slice(0,4);

    const list = $id('classDeltaList'); if(!list) return;
    list.innerHTML = '';
    top.forEach(r=>{
      const item = document.createElement('div');
      item.className = 'class-delta-item';
      const pctClass = (r.pct>=0)? 'pct-up':'pct-down';
      const pctTxt = (r.pct>=0?'+':'')+r.pct.toFixed(0)+'%';
      item.innerHTML = `
        <div class="class-delta-h"><span>ชั้น ${r.cls}</span><span class="${pctClass}">${pctTxt}</span></div>
        <div class="class-delta-sub">เฉลี่ยเดือนนี้: ${isFinite(r.avgNow)? r.avgNow.toFixed(2):'-'} ครั้ง/บัญชี</div>
        <div class="class-delta-sub">อ้างอิงเดือนก่อน: ${isFinite(r.avgPrev)? r.avgPrev.toFixed(2):'—'} ครั้ง/บัญชี</div>
      `;
      list.appendChild(item);
    });
    list.classList.remove('sk','sk-list');
  }catch(e){ console.warn('computeMonthlyDeltaByClass error', e); }
}

document.addEventListener('DOMContentLoaded', ()=>{
  const btn = $id('btnToggleClassDelta');
  const box = $id('classDeltaCard');
  if(btn && box){
    btn.addEventListener('click', ()=>{
      const hidden = box.classList.toggle('hidden');
      btn.innerHTML = hidden 
        ? '<i class="fa-solid fa-chevron-down"></i> แสดง' 
        : '<i class="fa-solid fa-chevron-up"></i> ซ่อน';
      if(!hidden){
        ensureTX().then(()=> computeMonthlyDeltaByClass());
      }
    });
  }
});

// ====== LEADERBOARD + REPORT HUB (namespaced) ======
window.WB = window.WB || {};

(function(WB){
  function weekRange(date){
    const d=new Date(date);
    const day=(d.getDay()+6)%7;
    const start=new Date(d); start.setDate(d.getDate()-day); start.setHours(0,0,0,0);
    const end=new Date(start); end.setDate(start.getDate()+7);
    return {start,end};
  }
  function currentTermRange(){
    const txArr = window.TX || [];
    let latest=null;
    txArr.forEach(r=>{
      const s=String(r['ปีการศึกษา']||'').trim();
      const m=s.match(/^([12])\/(\d{4})$/);
      if(m){ const t=+m[1], y=+m[2]; if(!latest || y>latest.y || (y===latest.y && t>latest.t)){ latest={t,y}; } }
    });
    if(latest){
      const y = latest.y>2400? latest.y-543: latest.y;
      return (latest.t===1)
        ? { start:new Date(y,4,1), end:new Date(y,10,1) }
        : { start:new Date(y,10,1), end:new Date(y+1,4,30,23,59,59,999) };
    }
    return monthRange(new Date());
  }
  function filterByRange(arr, keyDate, range){
    return (arr||[]).filter(r=>{ const d=parseThaiDate(r[keyDate]); return inRange(d, range.start, range.end); });
  }

  WB.leaderboardData = function(mode){
    const txArr = window.TX || [];
    const range = (mode==='week') ? weekRange(new Date())
                : (mode==='month') ? monthRange(new Date())
                : currentTermRange();
    const sample = filterByRange(txArr, 'วันที่', range);
    const perAcc = new Map();
    sample.forEach(r=>{
      const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(!acc) return;
      const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ');
      const act=String(r['รายการ']||'');
      const amt=toNumber(r['จำนวนเงิน']);
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
  };

  WB.renderLeaderboard = function(mode){
    const {rows, baseline} = WB.leaderboardData(mode);
    const grid = $id('lb-grid'); if(!grid) return;
    grid.innerHTML = '';
    rows.slice(0,10).forEach((r,i)=>{
      const div=document.createElement('div');
      div.className='lb-card';
      div.innerHTML = `<div class="lb-rank">${i+1}</div>
        <div class="lb-body">
          <div class="lb-name">${formatAccountMasked(r.acc)}</div>
          <div class="lb-sub">ชั้น ${r.cls} • ฝาก ${r.depCount} ครั้ง • ${fmtNumber(r.depSum)} บาท</div>
        </div>`;
      grid.appendChild(div);
    });
    setText('lb-desc', 'เกณฑ์อ้างอิง (ฝากเฉลี่ยต่อบัญชี) = ' + (baseline? baseline.toFixed(2): '0'));
  };

  let barChart, lineChart;
  WB.setCharts = function(mode){
    const {rows, range} = WB.leaderboardData(mode);
    const ctx1 = $id('barOverall')?.getContext('2d');
    const ctx2 = $id('lineTrend')?.getContext('2d');
    if(!ctx1 || !ctx2) return;

    const top = rows.slice(0,10);
    const labels = top.map(r=>formatAccountMasked(r.acc));
    const depCounts = top.map(r=>r.depCount);
    const depSums = top.map(r=>r.depSum);

    const txArr = window.TX||[];
    const span=[]; for(let d=new Date(range.start); d<range.end; d.setDate(d.getDate()+1)) span.push(new Date(d));
    const dailyDep = span.map(d=>{
      const dayTx = (txArr||[]).filter(r=>{
        const t=parseThaiDate(r['วันที่']);
        return t && t.getFullYear()===d.getFullYear() && t.getMonth()===d.getMonth() && t.getDate()===d.getDate() && r['รายการ']==='ฝาก';
      });
      return dayTx.reduce((a,b)=> a + toNumber(b['จำนวนเงิน']), 0);
    });

    if(barChart) barChart.destroy();
    if(lineChart) lineChart.destroy();
    barChart = new Chart(ctx1, { type:'bar',
      data:{ labels, datasets:[ {label:'จำนวนครั้งฝาก (Top 10)', data:depCounts}, {label:'ยอดฝากรวม (บาท)', data:depSums} ] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}} }
    });
    lineChart = new Chart(ctx2, { type:'line',
      data:{ labels: span.map(d=> d.toLocaleDateString('th-TH',{month:'short', day:'numeric'})), datasets:[ {label:'ยอดฝากรายวัน (บาท)', data:dailyDep} ] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}} }
    });
  };

  WB.bindLeaderboard = function(){
    document.querySelectorAll('[data-lb]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const mode=btn.getAttribute('data-lb');
        WB.renderLeaderboard(mode);
        WB.setCharts(mode);
        document.querySelectorAll('[data-lb]').forEach(b=>b.classList.toggle('active', b===btn));
      });
    });
    document.querySelectorAll('[data-rg]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const mode=btn.getAttribute('data-rg');
        WB.setCharts(mode);
        document.querySelectorAll('[data-rg]').forEach(b=>b.classList.toggle('active', b===btn));
      });
    });
    // Share leaderboard (LIFF)
    $id('share-leaderboard')?.addEventListener('click', async ()=>{
      try{
        if(typeof liff!=='undefined'){
          try{ await liff.init({liffId:LIFF_ID}); }catch(e){}
          if(!liff.isLoggedIn()){
            await Swal.fire({title:'ต้องเข้าสู่ระบบ LINE',text:'เพื่อแชร์ลีดเดอร์บอร์ด',icon:'info',confirmButtonText:'เข้าสู่ระบบ'});
            liff.login({redirectUri:location.href}); return;
          }
        }
      }catch(e){}
      const activeBtn = document.querySelector('[data-lb].active') || document.querySelector('[data-lb="week"]');
      const mode = activeBtn ? activeBtn.getAttribute('data-lb') : 'week';
      const {rows} = WB.leaderboardData(mode);
      const headers=['อันดับ','บัญชี','ชั้น','ครั้งฝาก','ยอดรวม'];
      const headerBox={type:'box',layout:'horizontal',contents:headers.map(h=>({type:'text',text:h,size:'xs',weight:'bold',align:'center',flex:1}))};
      const dataBoxes = rows.slice(0,10).map((r,i)=>({type:'box',layout:'horizontal',backgroundColor: i%2? '#FFFFFF':'#F5F6FA',contents:[
        {type:'text',text:String(i+1),size:'xs',align:'center',flex:1},
        {type:'text',text:formatAccountMasked(r.acc),size:'xs',align:'center',flex:2},
        {type:'text',text:r.cls,size:'xs',align:'center',flex:1},
        {type:'text',text:String(r.depCount),size:'xs',align:'center',flex:1},
        {type:'text',text:fmtNumber(r.depSum),size:'xs',align:'center',flex:2},
      ]}));
      const bubble={type:'bubble',size:'giga',body:{type:'box',layout:'vertical',contents:[
        {type:'text',text:'WDBank • ลีดเดอร์บอร์ด ('+mode+')',weight:'bold',size:'lg'},
        {type:'text',text:'อัปเดต: '+ thaiDateString(),color:'#7286D3',size:'sm'},
        {type:'separator',margin:'md'}, headerBox, {type:'separator',margin:'sm'},
        {type:'box',layout:'vertical',margin:'md',spacing:'sm',contents:dataBoxes}
      ]},
      footer:{type:'box',layout:'vertical',spacing:'sm',contents:[{type:'button',style:'primary',action:{type:'uri',label:'เปิด WDBank (LIFF)',uri:'https://liff.line.me/'+LIFF_ID}}]}};
      try{ await liff.shareTargetPicker([{type:'flex',altText:'WDBank • ลีดเดอร์บอร์ด',contents:bubble}]); if(liff.closeWindow) liff.closeWindow(); }catch(e){ console.warn('shareLeaderboard error', e); }
    });

    // Initial render after TX ready
    ensureTX().then(()=>{
      WB.renderLeaderboard('week'); WB.setCharts('week');
      document.querySelector('[data-lb="week"]')?.classList.add('active');
      document.querySelector('[data-rg="week"]')?.classList.add('active');
    });
  };
})(window.WB);

// ====== NAVIGATION ======
document.addEventListener('DOMContentLoaded', ()=>{
  // Init home cards
  try{ setMiniTip(); }catch(e){}
  ensureTX().then(()=>{ try{ computeMonthlyDeltaCard(); }catch(e){} });

  // Tabs via bottom nav
  const btns = document.querySelectorAll('.bottom-nav .nav-btn');
  const views = {
    home: $id('view-home'),
    leaderboard: $id('view-leaderboard'),
    report: $id('view-leaderboard') // reuse section (Report Hub อยู่ในนี้)
  };
  btns.forEach(b=> b.addEventListener('click', ()=>{
    btns.forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const key=b.getAttribute('data-nav');
    Object.values(views).forEach(v=>v?.classList.remove('show'));
    if(views[key]) views[key].classList.add('show');
  }));

  // Leaderboard bindings
  try{ window.WB?.bindLeaderboard(); }catch(e){}

  // (Optional) load nav avatar if have LINE profile later...
});
