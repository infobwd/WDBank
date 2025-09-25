
// ==== HELPERS ====
const $id = (id)=>document.getElementById(id);
const setText = (id, t)=>{ const el=$id(id); if(el) el.textContent=t; };
const toNumber = (v)=> Number(String(v??'').replace(/[, ]/g,''));
const fmtNumber = (v)=>{ const n=toNumber(v); return isFinite(n)? n.toLocaleString('th-TH', {maximumFractionDigits:2}) : String(v??''); };
const parseThaiDate = (s)=>{ try{ s=String(s); const [datePart, timePart='00:00:00']=s.split(',').map(x=>x.trim()); const [dd,mm,yy]=datePart.split('/').map(n=>parseInt(n,10)); const [HH,MM,SS]=timePart.split(':').map(n=>parseInt(n,10)); const gy=(yy>2400? yy-543:yy); return new Date(gy, (mm||1)-1, dd||1, HH||0, MM||0, SS||0); }catch(e){ return null; } };
const inRange = (d,s,e)=> d && d>=s && d<e;
const monthRange = (date)=>{ const s=new Date(date.getFullYear(), date.getMonth(), 1,0,0,0,0); const e=new Date(date.getFullYear(), date.getMonth()+1,1,0,0,0,0); return {start:s,end:e}; };
const weekRange = (date)=>{ const d=new Date(date); const day=(d.getDay()+6)%7; const start=new Date(d); start.setDate(d.getDate()-day); start.setHours(0,0,0,0); const end=new Date(start); end.setDate(start.getDate()+7); return {start,end}; };
const formatAccountMasked = (val)=>{ const raw=String(val??'').replace(/[ ,]/g,''); if(!raw) return '-'; return raw.slice(0,4)+' \u2022\u2022'; };

// ==== LOADERS ====
async function ensureTX(){
  if (Array.isArray(window.TX) && window.TX.length) return window.TX;
  const res = await fetch(window.SHEET_TX, {cache:'no-store'}); const data = await res.json();
  window.TX = Array.isArray(data)? data : []; return window.TX;
}
async function ensureAccounts(){
  if (window.ACC && window.ACC.size) return window.ACC;
  const res = await fetch(window.SHEET_ACCOUNTS,{cache:'no-store'}); const arr = await res.json();
  const map = new Map();
  (arr||[]).forEach(row=>{
    const acc = String(row['บัญชี']||row['รหัสนักเรียน']||row['User_Id']||'').trim();
    const bal = toNumber(row['จำนวนเงินคงเหลือ']||row['ยอดเงินคงเหลือ']||row['คงเหลือ']||row['Balance']||0);
    if(acc) map.set(acc, bal);
  });
  window.ACC = map; return window.ACC;
}

// ==== Mini Tips ====
window.MINI_TIPS = [
  'ออมเล็ก ๆ แต่บ่อย ๆ ดีต่อวินัยมากกว่าครั้งละก้อนใหญ่ 💪',
  'ตั้งเวลาออมประจำ เช่น จันทร์/พฤ. หลังเข้าแถว 5 นาที ⏰',
  'ตั้งเป้าหมายสั้น ๆ รายสัปดาห์ จะเห็นความก้าวหน้าเร็วขึ้น ✨',
  'ออมก่อนใช้: แยกเงินออมทันทีที่ได้รับเงิน 💼',
  'ชวนเพื่อนทั้งห้องออมพร้อมกัน สนุกและมีแรงใจขึ้น 🤝'
];
function setMiniTip(){ const el=$id('miniTip'); if(!el) return; const idx=Math.floor(Date.now()/86400000)%MINI_TIPS.length; el.textContent=MINI_TIPS[idx]; el.classList.remove('sk','sk-title'); }
function setMiniTipAnimated(){
  const el=$id('miniTip'); if(!el||!window.MINI_TIPS) return;
  const next = window.MINI_TIPS[Math.floor(Math.random()*window.MINI_TIPS.length)];
  el.classList.add('fade','fade-out');
  setTimeout(()=>{ el.textContent = next; el.classList.remove('fade-out'); el.classList.add('fade-in'); setTimeout(()=> el.classList.remove('fade','fade-in'), 480); }, 220);
}

// ==== Highlight Accounts (2 conditions) ====
async function computeHighlightTop2(){
  await ensureTX(); await ensureAccounts();
  const now=new Date(); const {start,end}=monthRange(now);
  const depCount=new Map(), accClass=new Map(), withdrew=new Set(), lastDep=new Map();
  (window.TX||[]).forEach(r=>{
    const d=parseThaiDate(r['วันที่']); if(!d) return;
    if(!inRange(d,start,end)) return;
    const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(!acc) return;
    const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ');
    const typ=String(r['รายการ']);
    if(typ==='ฝาก'){ depCount.set(acc,(depCount.get(acc)||0)+1); const prev=lastDep.get(acc); if(!prev||d>prev) lastDep.set(acc,d); accClass.set(acc,cls); }
    else if(typ==='ถอน'){ withdrew.add(acc); accClass.set(acc,cls); }
  });
  let sum=0,n=0; depCount.forEach(v=>{sum+=v;n++;}); const baseline = n? (sum/n):0;
  const accMap=window.ACC instanceof Map? window.ACC : new Map();
  const rows=[];
  depCount.forEach((cnt,acc)=>{
    if(cnt>baseline && !withdrew.has(acc)){
      const cls=accClass.get(acc)||'ไม่ระบุ';
      const last=lastDep.get(acc)? lastDep.get(acc).getTime():0;
      const bal=accMap.get(acc)||0;
      const over=baseline? ((cnt-baseline)/baseline*100):0;
      rows.push({acc,cls,cnt,last,bal,over});
    }
  });
  rows.sort((a,b)=> b.cnt - a.cnt || b.last - a.last || b.bal - a.bal);
  const grid=$id('highlightGrid'); const note=$id('highlightNote');
  grid.innerHTML='';
  if(rows.length===0){ if(note) note.textContent='ยังไม่มีข้อมูลที่เข้าเงื่อนไขในเดือนนี้'; return; }
  rows.slice(0,3).forEach(r=>{
    const el=document.createElement('div'); el.className='hi-item';
    const lastTxt = r.last? new Date(r.last).toLocaleDateString('th-TH',{day:'2-digit',month:'short'}) + ' ' + new Date(r.last).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',hour12:false}) : '-';
    el.innerHTML = `<div class="hi-h">บัญชี ${formatAccountMasked(r.acc)}</div>
      <div class="hi-sub">ชั้น ${r.cls}</div>
      <div class="hi-sub">ฝากเดือนนี้: <b>${r.cnt}</b> ครั้ง • ล่าสุด: ${lastTxt}</div>
      <div class="hi-kpi">มากกว่าเฉลี่ยทั้งโรงเรียน ~ ${(isFinite(r.over)? (r.over>=0? '+':'')+r.over.toFixed(0):'0')}% • ยอดเงิน: ${fmtNumber(r.bal)} ฿</div>`;
    grid.appendChild(el);
  });
}

// ==== Gamification Core ====
function dayKey(d){ return d.toISOString().slice(0,10); }
function computeWeeklyMission(){
  const {start,end}=weekRange(new Date());
  const map=new Map();
  (window.TX||[]).forEach(r=>{
    const d=parseThaiDate(r['วันที่']); if(!d) return;
    if(!inRange(d,start,end)) return;
    if(String(r['รายการ'])!=='ฝาก') return;
    const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(!acc) return;
    map.set(acc,(map.get(acc)||0)+1);
  });
  let done=0; map.forEach(v=>{ if(v>=3) done++; });
  const total=map.size; const pct= total? Math.round(done/total*100):0;
  const bar=$id('gmProgressBar'); if(bar) bar.style.width=pct+'%';
  setText('gmDone', String(done)); setText('gmTotal', String(total)); setText('gmPct', pct+'%');
  $id('gmProgressBar')?.parentElement?.classList.remove('sk','sk-card');
}

function clsSkinKey(name){
  const n = String(name||'').replace(/\s+/g,'').replace('ป.','ป');
  if (n.startsWith('ป.')){
    const d = n.replace('ป.','');
    return 'skin-ป'+d;
  }
  return 'skin-ป1';
}

function computeWeeklyClassLeaderboard(){
  const {start,end}=weekRange(new Date());
  const perClassAcc=new Map();
  (window.TX||[]).forEach(r=>{
    const d=parseThaiDate(r['วันที่']); if(!d) return;
    if(!inRange(d,start,end)) return;
    if(String(r['รายการ'])!=='ฝาก') return;
    const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(!acc) return;
    const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ');
    const m = perClassAcc.get(cls)||new Map(); m.set(acc,(m.get(acc)||0)+1); perClassAcc.set(cls,m);
  });
  const rows=[]; perClassAcc.forEach((m,cls)=>{ let sum=0,n=0; m.forEach(v=>{ sum+=v; n++; }); const avg=n? (sum/n):0; rows.push({cls,avg,n}); });
  rows.sort((a,b)=> b.avg - a.avg || b.n - a.n);
  const list=$id('gmClassTop'); list.innerHTML='';
  rows.slice(0,5).forEach((r,i)=>{
    const el=document.createElement('div'); el.className='gm-item';
    el.innerHTML = `#${i+1} ชั้น <b>${r.cls}</b> — เฉลี่ย <b>${r.avg.toFixed(2)}</b> ครั้ง/บัญชี (มี ${r.n} บัญชี)`;
    const badge=document.createElement('span'); badge.className='cls-badge '+clsSkinKey(r.cls); badge.textContent=r.cls; el.appendChild(badge);
    list.appendChild(el);
  });
}

function computeStreaksTop(){
  const now=new Date(); const from=new Date(now); from.setDate(now.getDate()-30); from.setHours(0,0,0,0);
  const depDays=new Map();
  (window.TX||[]).forEach(r=>{
    if(String(r['รายการ'])!=='ฝาก') return;
    const d=parseThaiDate(r['วันที่']); if(!d || d<from) return;
    const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(!acc) return;
    const key=dayKey(d);
    let set=depDays.get(acc); if(!set){ set=new Set(); depDays.set(acc,set); }
    set.add(key);
  });
  function currentStreak(set){
    let streak=0; const d=new Date(); d.setHours(0,0,0,0);
    for(let i=0;i<31;i++){ const k=dayKey(d); if(set.has(k)){ streak++; d.setDate(d.getDate()-1);} else break; }
    return streak;
  }
  const accMap = (window.ACC instanceof Map)? window.ACC : new Map();
  const rows=[];
  depDays.forEach((set,acc)=>{
    const s=currentStreak(set);
    const days=[...set].sort(); const last = days.length? new Date(days[days.length-1]) : null;
    rows.push({acc, s, last: last? last.getTime():0, bal: accMap.get(acc)||0});
  });
  rows.sort((a,b)=> b.s - a.s || b.last - a.last || b.bal - a.bal);

  const grid=$id('gmStreakTop'); grid.innerHTML='';
  rows.slice(0,5).forEach((r,i)=>{
    const el=document.createElement('div'); el.className='gm-badge';
    let clazz=''; let label='';
    if(r.s>=10){ clazz='badge-10'; label='Streak 10+'; }
    else if(r.s>=5){ clazz='badge-5'; label='Streak 5+'; }
    else if(r.s>=3){ clazz='badge-3'; label='Streak 3+'; }
    const lastTxt = r.last? new Date(r.last).toLocaleDateString('th-TH',{day:'2-digit',month:'short'}) + ' ' + new Date(r.last).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',hour12:false}) : '-';
    el.innerHTML = `<div class="gm-medal">🏅</div>
      <div class="gm-btxt ${clazz}">
        <div class="gm-btitle">${label||'เริ่มต้นดี!'}</div>
        <div class="gm-bmeta">บัญชี ${formatAccountMasked(r.acc)} • ล่าสุด: ${lastTxt}</div>
        <div class="gm-kpi">สตรีคปัจจุบัน: <b>${r.s}</b> วันติด</div>
      </div>`;
    grid.appendChild(el);
  });
}

// Class mission UI
function listClassesThisWeek(){
  const {start,end}=weekRange(new Date());
  const set=new Set();
  (window.TX||[]).forEach(r=>{
    const d=parseThaiDate(r['วันที่']); if(!d) return;
    if(!inRange(d,start,end)) return;
    if(String(r['รายการ'])!=='ฝาก') return;
    const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ');
    set.add(cls);
  });
  return [...set].sort();
}
function populateClassSelect(){
  const sel=$id('gmClassSelect'); if(!sel) return;
  const classes=listClassesThisWeek();
  sel.innerHTML='';
  if(classes.length===0){ sel.innerHTML='<option value="">ยังไม่มีข้อมูลสัปดาห์นี้</option>'; }
  else {
    classes.forEach(c=>{ const opt=document.createElement('option'); opt.value=c; opt.textContent=c; sel.appendChild(opt); });
    sel.classList.remove('sk','sk-title');
  }
}
function computeClassMissionProgress(clsName){
  const {start,end}=weekRange(new Date());
  const map=new Map();
  (window.TX||[]).forEach(r=>{
    const d=parseThaiDate(r['วันที่']); if(!d) return;
    if(!inRange(d,start,end)) return;
    if(String(r['รายการ'])!=='ฝาก') return;
    const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ'); if(cls!==clsName) return;
    const acc=String(r['บัญชี']||r['รหัสนักเรียน']||'').trim(); if(!acc) return;
    map.set(acc,(map.get(acc)||0)+1);
  });
  let done=0; map.forEach(v=>{ if(v>=3) done++; });
  const total=map.size; const pct = total? Math.round(done/total*100) : 0;
  setText('gmClsDone', String(done)); setText('gmClsTotal', String(total)); setText('gmClsPct', pct+'%');
  const bar=$id('gmClsBar'); if(bar) bar.style.width=pct+'%';
  $id('gmClsBar')?.parentElement?.classList.remove('sk','sk-card');
  return {done,total,pct,map};
}

// LINE Share (Class Mission)
async function shareClassMission(){
  try{
    const sel=$id('gmClassSelect'); if(!sel || !sel.value){ Swal.fire('Info','ยังไม่มีชั้นให้แชร์','info'); return; }
    const cls=sel.value;
    const {done,total,pct,map} = computeClassMissionProgress(cls);
    const arr=[...map.entries()].map(([acc,cnt])=>({acc,cnt})).sort((a,b)=>b.cnt-a.cnt).slice(0,10);
    const items = arr.map(r=>({ type:'box', layout:'horizontal', contents:[
      {type:'text', text: formatAccountMasked(r.acc), size:'sm', flex:2},
      {type:'text', text: String(r.cnt)+' ครั้ง', size:'sm', align:'end', flex:1}
    ] }));
    const flex = {
      type:'flex',
      altText:`ภารกิจสัปดาห์นี้ - ห้อง ${cls}`,
      contents:{ type:'bubble', size:'mega',
        hero:{ type:'image', url:'https://raw.githubusercontent.com/infobwd/wdconnect/main/top10.png', size:'full', aspectRatio:'20:13', aspectMode:'cover' },
        body:{ type:'box', layout:'vertical', contents:[
          {type:'text', text:'ภารกิจสัปดาห์นี้', weight:'bold', size:'lg'},
          {type:'text', text:`ห้อง ${cls}`, color:'#64748b', size:'sm'},
          {type:'separator', margin:'md'},
          {type:'text', text:`สำเร็จ ${done}/${total} บัญชี • ${pct}%`, size:'md', weight:'bold', color:'#059669', margin:'sm'},
          {type:'box', layout:'vertical', margin:'md', spacing:'sm', contents: items.length? items : [{type:'text', text:'(ยังไม่มีรายการ)'}] }
        ]},
        footer:{ type:'box', layout:'vertical', contents:[
          {type:'button', style:'primary', action:{type:'uri', label:'เปิดดูรายละเอียด', uri: (window.LIFF_DEEPLINK || 'https://liff.line.me/')} }
        ]}
      }
    };
    if(!window.liff){ Swal.fire('Error','ยังไม่พบ LIFF SDK','error'); return; }
    if(!window.LIFF_ID){ Swal.fire('Error','ยังไม่ตั้งค่า LIFF_ID','error'); return; }
    await liff.init({ liffId: window.LIFF_ID });
    if(!liff.isLoggedIn()) liff.login();
    const res = await liff.shareTargetPicker([flex]);
    if(res){ Swal.fire('สำเร็จ','แชร์ผลภารกิจแล้ว','success'); }
  }catch(e){ Swal.fire('Error', String(e), 'error'); }
}

// ==== BOOT ====
document.addEventListener('DOMContentLoaded', async ()=>{
  try{
    setMiniTip();
    setInterval(setMiniTipAnimated, 12000);
    await ensureTX(); await ensureAccounts();
    await computeHighlightTop2();
    computeWeeklyMission();
    computeWeeklyClassLeaderboard();
    computeStreaksTop();
    populateClassSelect();
    const sel=$id('gmClassSelect'); if(sel && sel.value){ computeClassMissionProgress(sel.value); }
    $id('gmShareClass')?.addEventListener('click', shareClassMission);
  }catch(e){ console.warn('init error', e); }
});
