// =================== Config ===================
const LIFF_ID = '2005230346-2OVa774O'; // แทนด้วย LIFF ของพี่

const SHEET_AMOUNT      = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortบัญชีเงินมากและฝากมากกว่าหรือเท่ากับค่าเฉลี่ย';
const SHEET_FREQUENT    = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortบัญชีฝากถี่มาก';
const SHEET_DEPOSITONLY = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortบัญชีไม่ถอนและฝากมากกว่าหรือเท่ากับค่าเฉลี่ย';
const SHEET_TX          = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortรายการฝากและถอน';
const SHEET_ACCOUNTS    = 'https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo//บัญชี';

// =================== State & Utils ===================
let D_AMOUNT=[], D_FREQ=[], D_DEP=[], TX=[], AC=[];
let TOP_AMOUNT=[], TOP_FREQ=[], TOP_DEP=[];

function isNumeric(val){ if(val===null||val===undefined) return false; var n=Number(String(val).replace(/[, ]/g,'')); return isFinite(n); }
function toNumber(val){ return Number(String(val).replace(/[, ]/g,'')); }
function fmtNumber(val){ var n=Number(String(val).replace(/[, ]/g,'')); return isFinite(n)? n.toLocaleString('th-TH', { maximumFractionDigits:2 }) : String(val==null?'':val); }
function cut(s,len){ s=String(s==null?'':s); return s.length>len? s.slice(0,len-1)+'…' : s; }
function thaiDateString(d){ if(!d) d=new Date(); return d.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}); }
function isAccountHeader(h){ return /(เลข\s*บัญชี|บัญชี|account|รหัสนักเรียน)/i.test(String(h)); }
function isCountHeader(h){ return /(จำนวน|ครั้ง|count)/i.test(String(h)); }
function isBalanceHeader(h){ return /(คงเหลือ|ยอดคงเหลือ|ยอด|รวม|amount|total|เงิน)/i.test(String(h)); }
function isClassHeader(h){ return /(ชั้น|ห้อง|class)/i.test(String(h)); }
function formatAccountMasked(val){ var raw=String(val==null?'':val).replace(/\s+/g,'').replace(/,/g,''); if(!raw) return '-'; var first=raw.slice(0,4); return (first+' ••'); }
function headersOf(rows){ return Object.keys(rows && rows[0] ? rows[0] : {}); }
function clearSkeleton(el){ if(!el) return; el.classList.remove('sk','sk-text','sk-title'); }

async function fetchJSON(url,opt){ opt=opt||{}; var timeout=opt.timeout||12000; var retries=opt.retries==null?2:opt.retries;
  async function attempt(){ const ctrl=new AbortController(); const t=setTimeout(function(){ctrl.abort()}, timeout);
    try{ const res=await fetch(url+(url.indexOf('?')>-1?'&':'?')+'_ts='+Date.now(),{signal:ctrl.signal,cache:'no-store'});
      clearTimeout(t); if(!res.ok) throw new Error('HTTP '+res.status); return await res.json(); }
    catch(e){ clearTimeout(t); throw e; } }
  for(let i=0;i<=retries;i++){ try{ return await attempt(); } catch(err){ if(i===retries) throw err; await new Promise(r=>setTimeout(r, 600*(i+1))); } }
}
function parseThaiDate(s){ try{ s=String(s); var parts=s.split(','); var datePart=parts[0].trim(); var timePart=(parts[1]||'00:00:00').trim();
  var dmy=datePart.split('/').map(x=>parseInt(x,10)); var tms=timePart.split(':').map(x=>parseInt(x,10)); var gy=(dmy[2]>2400)? dmy[2]-543 : dmy[2];
  return new Date(gy, dmy[1]-1, dmy[0], tms[0]||0, tms[1]||0, tms[2]||0); }catch(e){return null;} }
function isThisWeek(date){ if(!date) return false; const now=new Date(); const start=new Date(now); const day=(now.getDay()+6)%7; start.setDate(now.getDate()-day); start.setHours(0,0,0,0); const end=new Date(start); end.setDate(start.getDate()+7); return date>=start && date<end; }

async function loadAll(){
  const todayEl=document.getElementById('todayThai'); todayEl.textContent=thaiDateString(); clearSkeleton(todayEl);
  try{
    const settled = await Promise.allSettled([ fetchJSON(SHEET_AMOUNT), fetchJSON(SHEET_FREQUENT), fetchJSON(SHEET_DEPOSITONLY), fetchJSON(SHEET_TX), fetchJSON(SHEET_ACCOUNTS) ]);
    const A=settled[0],B=settled[1],C=settled[2],T=settled[3],X=settled[4];
    if(A.status==='fulfilled') D_AMOUNT=A.value; if(B.status==='fulfilled') D_FREQ=B.value; if(C.status==='fulfilled') D_DEP=C.value;
    if(T.status==='fulfilled') TX=T.value; if(X.status==='fulfilled') AC=X.value;
  }catch(e){ console.error('โหลดข้อมูลล้มเหลว', e); Swal.fire('เกิดข้อผิดพลาด','มีปัญหาในการโหลดข้อมูลบางส่วน โปรดลองใหม่อีกครั้ง','error'); }
  TOP_AMOUNT=D_AMOUNT.slice(0,10); TOP_FREQ=D_FREQ.slice(0,10); TOP_DEP=D_DEP.slice(0,10);
  renderAllStars(); renderWeeklyKPIs(); renderLatest10();
  renderTable('th-amount','tb-amount',TOP_AMOUNT); renderTable('th-frequent','tb-frequent',TOP_FREQ); renderTable('th-depositonly','tb-depositonly',TOP_DEP);
}

// Rendering
function renderTable(headId, bodyId, rows){
  const headEl=document.getElementById(headId); const bodyEl=document.getElementById(bodyId); headEl.innerHTML=''; bodyEl.innerHTML='';
  if(!(rows && rows.length)){ headEl.innerHTML='<th>ข้อมูล</th>'; bodyEl.innerHTML='<tr><td>ไม่พบข้อมูล</td></tr>'; return; }
  const headers=headersOf(rows);
  headers.forEach(function(h){ const th=document.createElement('th'); th.textContent=h; headEl.appendChild(th); });
  rows.forEach(function(r){ const tr=document.createElement('tr'); headers.forEach(function(h){ const td=document.createElement('td'); const raw=r[h];
      if(isAccountHeader(h)){ const span=document.createElement('span'); span.className='acc-pill'; span.textContent=formatAccountMasked(raw); td.appendChild(span); }
      else if(isNumeric(raw)){ td.textContent=fmtNumber(raw); } else { td.textContent=String(raw==null?'':raw); }
      tr.appendChild(td); }); bodyEl.appendChild(tr); });
}
function getAccountKey(headers, row){ const accHeader=headers.find(isAccountHeader); const k = accHeader? row[accHeader] : Object.values(row)[0]; return String(k==null?'':k).trim(); }
function renderAllStars(){
  const wrap=document.getElementById('allstars'); wrap.innerHTML='';
  if(!(TOP_AMOUNT.length && TOP_FREQ.length && TOP_DEP.length)){ wrap.innerHTML='<div class="subtitle">ยังไม่พอสร้างการ์ดสรุป</div>'; return; }
  const A=new Map(TOP_AMOUNT.map(r=>[getAccountKey(headersOf(TOP_AMOUNT),r),r])); const B=new Map(TOP_FREQ.map(r=>[getAccountKey(headersOf(TOP_FREQ),r),r])); const C=new Map(TOP_DEP.map(r=>[getAccountKey(headersOf(TOP_DEP),r),r]));
  const keysA=Array.from(A.keys()); const intersection=keysA.filter(k=>B.has(k)&&C.has(k)).slice(0,3);
  const balanceH=headersOf(TOP_AMOUNT).find(isBalanceHeader)||headersOf(TOP_FREQ).find(isBalanceHeader)||headersOf(TOP_DEP).find(isBalanceHeader);
  const countH=headersOf(TOP_AMOUNT).find(isCountHeader)||headersOf(TOP_FREQ).find(isCountHeader)||headersOf(TOP_DEP).find(isCountHeader);
  const classH=headersOf(TOP_AMOUNT).find(isClassHeader)||headersOf(TOP_FREQ).find(isClassHeader)||headersOf(TOP_DEP).find(isClassHeader);
  intersection.forEach(function(key){
    const rA=A.get(key)||{}, rB=B.get(key)||{}, rC=C.get(key)||{};
    const cls=(classH&&(rA[classH]||rB[classH]||rC[classH]))? String(rA[classH]||rB[classH]||rC[classH]):'ไม่ระบุ';
    const amtSrc=(rA[balanceH]||rB[balanceH]||rC[balanceH]); const cntSrc=(rA[countH]||rB[countH]||rC[countH]);
    const amountTxt=balanceH?(isNumeric(amtSrc)? fmtNumber(amtSrc): '-'):'-'; const countTxt=countH?(isNumeric(cntSrc)? fmtNumber(cntSrc): '-'):'-';
    const card=document.createElement('div'); card.className='star-card';
    card.innerHTML=[
      '<div class="star-hdr">','<i class="fa-solid fa-trophy" style="color:#eab308"></i>','<div>','<div class="star-acc">'+formatAccountMasked(key)+'</div>','<div class="star-badges">',
      '<span class="badge blue"><i class="fa-solid fa-baht-sign"></i> ยอดเงินสูง</span>','<span class="badge green"><i class="fa-solid fa-clock-rotate-left"></i> ฝากถี่</span>','<span class="badge purple"><i class="fa-solid fa-ban"></i> ไม่เคยถอน</span>',
      '</div>','</div>','</div>','<div class="subtitle">ยอดคงเหลือโดยประมาณ: <strong>'+amountTxt+'</strong> บาท • จำนวนครั้งฝาก: <strong>'+countTxt+'</strong></div>','<div class="class-tag"><i class="fa-solid fa-school"></i> '+cls+'</div>'
    ].join('');
    wrap.appendChild(card);
  });
}
function renderLatest10(){
  const rows=(TX||[]).map(function(r){ const d=parseThaiDate(r['วันที่']); var obj={}; Object.keys(r).forEach(k=>obj[k]=r[k]); obj.__d=d; return obj; }).filter(r=>r.__d).sort((a,b)=>b.__d-a.__d).slice(0,10);
  const headers=['วันที่','บัญชี','รายการ','จำนวนเงิน','ชั้น']; const thead=document.getElementById('th-latest'); const tbody=document.getElementById('tb-latest'); thead.innerHTML=''; tbody.innerHTML='';
  headers.forEach(function(h){ const th=document.createElement('th'); th.textContent=h; thead.appendChild(th); });
  rows.forEach(function(r){ const tr=document.createElement('tr'); const act=String(r['รายการ']||''); const badge='<span class="badge-act '+(act==='ฝาก'?'badge-dep':'badge-wdr')+'"><i class="fa-solid '+(act==='ฝาก'?'fa-arrow-down':'fa-arrow-up')+'"></i> '+act+'</span>';
    const cells=[ r['วันที่']||'', formatAccountMasked(r['บัญชี']||''), '', fmtNumber(r['จำนวนเงิน']||''), r['ชั้น']||r['ห้อง']||'' ];
    cells.forEach(function(v,i){ const td=document.createElement('td'); if(i===2){ td.innerHTML=badge; } else { td.textContent=String(v);} tr.appendChild(td); }); tbody.appendChild(tr); });
}

// KPIs
function renderWeeklyKPIs(){
  let depCount=0,wdrCount=0,depAmt=0,wdrAmt=0; const classCount=new Map();
  (TX||[]).forEach(function(r){ const d=parseThaiDate(r['วันที่']); if(!isThisWeek(d)) return; const act=String(r['รายการ']||'').trim(); const amt=toNumber(r['จำนวนเงิน']); const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ');
    if(act==='ฝาก'){ depCount++; depAmt+=isFinite(amt)?amt:0; } else if(act==='ถอน'){ wdrCount++; wdrAmt+=isFinite(amt)?amt:0; } classCount.set(cls,(classCount.get(cls)||0)+1); });
  let topClass='-',topClassCount=0; for(const [k,v] of classCount.entries()){ if(v>topClassCount){ topClass=k; topClassCount=v; } }
  const elDepC=document.getElementById('kpiDepCount'), elDepA=document.getElementById('kpiDepAmt'), elWdrC=document.getElementById('kpiWdrCount'), elWdrA=document.getElementById('kpiWdrAmt'), elNet=document.getElementById('kpiNet'), elTop=document.getElementById('kpiTopClass'), elTopD=document.getElementById('kpiTopClassDetail');
  elDepC.textContent=depCount.toLocaleString('th-TH')+' ครั้ง'; clearSkeleton(elDepC);
  elDepA.textContent='รวม '+fmtNumber(depAmt)+' บาท'; clearSkeleton(elDepA);
  elWdrC.textContent=wdrCount.toLocaleString('th-TH')+' ครั้ง'; clearSkeleton(elWdrC);
  elWdrA.textContent='รวม '+fmtNumber(wdrAmt)+' บาท'; clearSkeleton(elWdrA);
  elNet.textContent=fmtNumber(depAmt-wdrAmt)+' บาท'; clearSkeleton(elNet);
  elTop.textContent=topClass; clearSkeleton(elTop); elTopD.textContent=topClass==='-'?'-':(topClassCount.toLocaleString('th-TH')+' ครั้งสัปดาห์นี้'); clearSkeleton(elTopD);
}

// LIFF
async function ensureLogin(){ try{ await liff.init({liffId:LIFF_ID}); }catch(e){} if(!liff.isLoggedIn()){ await Swal.fire({title:'ต้องเข้าสู่ระบบ LINE',text:'เพื่อแชร์ผ่าน LINE จำเป็นต้องเข้าสู่ระบบก่อน',icon:'info',confirmButtonText:'เข้าสู่ระบบ'}); liff.login({redirectUri:location.href}); throw new Error('login-redirect'); } }
async function loadProfileAvatar(){ try{ await liff.init({liffId:LIFF_ID}); if(liff.isLoggedIn()){ const p=await liff.getProfile(); if(p && p.pictureUrl) document.getElementById('avatar').src=p.pictureUrl; if(p && p.displayName){ document.getElementById('prof-name').textContent=p.displayName; document.getElementById('prof-status').textContent='เข้าสู่ระบบแล้ว'; } document.getElementById('loginBadge').classList.remove('show'); } else { document.getElementById('prof-status').textContent='ยังไม่เข้าสู่ระบบ'; document.getElementById('loginBadge').classList.add('show'); } }catch(e){ document.getElementById('prof-status').textContent='ยังไม่เข้าสู่ระบบ'; document.getElementById('loginBadge').classList.add('show'); } }

// Flex share
function flexWithOpenButton(bubble){ var uri='https://liff.line.me/'+LIFF_ID; var footer={type:'box',layout:'vertical',spacing:'sm',contents:[{type:'button',style:'primary',action:{type:'uri',label:'เปิด WDBank (LIFF)',uri:uri}}]}; bubble.footer=footer; return bubble; }
function buildFlexFromRows(title,rows){
  if(!(rows && rows.length)) return null; const headers=Object.keys(rows[0]);
  const headerBox={type:'box',layout:'horizontal',contents:headers.map(function(h){return {type:'text',text:cut(h,12),size:'xs',weight:'bold',align:'center',flex:1};})};
  const dataRows=rows.map(function(r,i){ return {type:'box',layout:'horizontal',backgroundColor:(i%2?'#FFFFFF':'#F5F6FA'),contents:headers.map(function(h){ var v=isAccountHeader(h)? formatAccountMasked(r[h]) : (isNumeric(r[h])? fmtNumber(r[h]) : (r[h]==null?'':r[h])); return {type:'text',text:cut(v,16),size:'xs',align:'center',flex:1}; })}; });
  const bubble={type:'bubble',size:'giga',body:{type:'box',layout:'vertical',contents:[{type:'text',text:title,weight:'bold',size:'lg'},{type:'text',text:'ออมก่อนใช้ • '+thaiDateString(),color:'#7286D3',size:'sm'},{type:'separator',margin:'md'},headerBox,{type:'separator',margin:'sm'},{type:'box',layout:'vertical',margin:'md',spacing:'sm',contents:dataRows}]}};
  return {type:'flex',altText:title,contents:flexWithOpenButton(bubble)};
}
async function shareAmount(){ await ensureLogin(); const flex=buildFlexFromRows('WDBank • TOP 10 ยอดเงินสูง', TOP_AMOUNT); await liff.shareTargetPicker([flex]); if(liff.closeWindow) liff.closeWindow(); }
async function shareFrequent(){ await ensureLogin(); const flex=buildFlexFromRows('WDBank • TOP 10 ฝากถี่มาก', TOP_FREQ); await liff.shareTargetPicker([flex]); if(liff.closeWindow) liff.closeWindow(); }
async function shareDepositOnly(){ await ensureLogin(); const flex=buildFlexFromRows('WDBank • TOP 10 ไม่เคยถอน (ฝาก ≥ ค่าเฉลี่ย)', TOP_DEP); await liff.shareTargetPicker([flex]); if(liff.closeWindow) liff.closeWindow(); }
async function shareAllStars(){
  await ensureLogin(); const A=new Set(TOP_AMOUNT.map(r=>String(Object.values(r)[0]))); const B=new Set(TOP_FREQ.map(r=>String(Object.values(r)[0]))); const C=new Set(TOP_DEP.map(r=>String(Object.values(r)[0])));
  const inter=[...A].filter(k=>B.has(k)&&C.has(k)).slice(0,3).map(k=>({key:k})); const headers=['เลขบัญชี','คุณสมบัติ'];
  const headerBox={type:'box',layout:'horizontal',contents:headers.map(function(h){return {type:'text',text:h,size:'xs',weight:'bold',align:'center',flex:1};})};
  const dataRows=inter.map(function(r,i){ return {type:'box',layout:'horizontal',backgroundColor:(i%2?'#FFFFFF':'#F5F6FA'),contents:[{type:'text',text:cut(formatAccountMasked(r.key),18),size:'xs',align:'center',flex:1},{type:'text',text:'ยอดสูง • ฝากถี่ • ไม่เคยถอน',size:'xs',align:'center',flex:1}]}; });
  const bubble={type:'bubble',size:'giga',body:{type:'box',layout:'vertical',contents:[{type:'text',text:'WDBank • 3 บัญชีเด่น',weight:'bold',size:'lg'},{type:'text',text:'ออมก่อนใช้ • '+thaiDateString(),color:'#7286D3',size:'sm'},{type:'separator',margin:'md'},headerBox,{type:'separator',margin:'sm'},{type:'box',layout:'vertical',margin:'md',spacing:'sm',contents:dataRows}]}};
  const flex={type:'flex',altText:'WDBank • 3 บัญชีเด่น',contents:flexWithOpenButton(bubble)}; await liff.shareTargetPicker([flex]); if(liff.closeWindow) liff.closeWindow();
}

// PDF
function buildPDFShell(title){ const school='โรงเรียนของเรา'; const wrap=document.createElement('div'); const header=document.createElement('div'); header.className='header'; const img=document.createElement('img'); img.src='./assets/crest.svg'; img.alt=school; const headBox=document.createElement('div'); const h1=document.createElement('h1'); h1.textContent=title; const h2=document.createElement('div'); h2.style.fontSize='14px'; h2.style.color='#334155'; h2.style.fontWeight='700'; h2.textContent=school; headBox.appendChild(h1); headBox.appendChild(h2); header.appendChild(img); header.appendChild(headBox); wrap.appendChild(header); const meta=document.createElement('div'); meta.className='meta'; meta.textContent = school+' • ออมก่อนใช้ • วันที่ '+thaiDateString(); wrap.appendChild(meta); return wrap; }
async function renderPDF(node, filename){ const report=document.getElementById('pdfReport'); report.innerHTML=''; report.appendChild(node); const canvas=await html2canvas(report,{scale:2, backgroundColor:'#ffffff'}); const imgData=canvas.toDataURL('image/png'); const { jsPDF }=window.jspdf; const pdf=new jsPDF({orientation:'p', unit:'pt', format:'a4'}); const pageWidth=pdf.internal.pageSize.getWidth(), pageHeight=pdf.internal.pageSize.getHeight(), margin=24; const imgWidth=pageWidth - margin*2; const imgHeight = canvas.height * imgWidth / canvas.width; if(imgHeight <= pageHeight - margin*2){ pdf.addImage(imgData,'PNG',margin,margin,imgWidth,imgHeight); } else{ let sH=0; const pageCanvas=document.createElement('canvas'); const ctx=pageCanvas.getContext('2d'); const ratio=imgWidth/canvas.width; const sliceHeightPx=(pageHeight - margin*2)/ratio; while(sH<canvas.height){ const slice=Math.min(sliceHeightPx, canvas.height - sH); pageCanvas.width=canvas.width; pageCanvas.height=slice; ctx.drawImage(canvas,0,sH,canvas.width,slice,0,0,canvas.width,slice); const sliceData=pageCanvas.toDataURL('image/png'); const sliceHpt=slice*ratio; pdf.addImage(sliceData,'PNG',margin,margin,imgWidth,sliceHpt); sH+=slice; if(sH<canvas.height) pdf.addPage(); } } pdf.save(filename); }
function buildPDFTable(headers, rows){ const table=document.createElement('table'); const thead=document.createElement('thead'); const trh=document.createElement('tr'); headers.forEach(function(h){ const th=document.createElement('th'); th.textContent=h; trh.appendChild(th); }); thead.appendChild(trh); table.appendChild(thead); const tbody=document.createElement('tbody'); rows.forEach(function(r){ const tr=document.createElement('tr'); headers.forEach(function(h){ const td=document.createElement('td'); const v=r[h]; const text=isAccountHeader(h)? formatAccountMasked(v) : (isNumeric(v)? fmtNumber(v): String(v==null?'':v)); td.textContent=text; tr.appendChild(td); }); tbody.appendChild(tr); }); table.appendChild(tbody); return table; }
async function exportPDF(which){ let title='', headers=[], rows=[]; if(which==='amount'){ title='รายงาน TOP 10 ยอดเงินสูง • ฝาก ≥ ค่าเฉลี่ย'; rows=TOP_AMOUNT; } if(which==='frequent'){ title='รายงาน TOP 10 บัญชีฝากถี่มาก'; rows=TOP_FREQ; } if(which==='depositonly'){ title='รายงาน TOP 10 ไม่เคยถอน • ฝาก ≥ ค่าเฉลี่ย'; rows=TOP_DEP; } if(!rows.length){ return alert('ไม่มีข้อมูลสำหรับรายงาน'); } headers=headersOf(rows); const wrap=buildPDFShell(title); wrap.appendChild(buildPDFTable(headers, rows)); addSignatureBlock(wrap); await renderPDF(wrap, 'WDBank-'+which+'-'+new Date().toISOString().slice(0,10)+'.pdf'); }
function addSignatureBlock(wrap){ const row=document.createElement('div'); row.className='sign-row'; const left=document.createElement('div'); left.className='sign'; left.innerHTML='<div class="line"></div><div>ผู้บริหารสถานศึกษา (ลงชื่อ)</div>'; const right=document.createElement('div'); right.className='sign'; right.innerHTML='<div class="line"></div><div>ผู้รับผิดชอบงานธนาคารโรงเรียน (ลงชื่อ)</div>'; row.appendChild(left); row.appendChild(right); wrap.appendChild(row); }
function parseDateRangeFilter(kind){ const now=new Date(); let start,end; if(kind==='week'){ start=new Date(now); const day=(now.getDay()+6)%7; start.setDate(now.getDate()-day); start.setHours(0,0,0,0); end=new Date(start); end.setDate(start.getDate()+7); } else if(kind==='month'){ start=new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0); end=new Date(now.getFullYear(), now.getMonth()+1, 1, 0,0,0,0); } return {start:start,end:end}; }
function inRange(d,start,end){ return d && d>=start && d<end; }
function buildTxInsightsRange(start,end){ let depCount=0,wdrCount=0,depAmt=0,wdrAmt=0; const classCount=new Map(); (TX||[]).forEach(function(r){ const d=parseThaiDate(r['วันที่']); if(!inRange(d,start,end)) return; const act=String(r['รายการ']||'').trim(); const amt=toNumber(r['จำนวนเงิน']); const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ'); if(act==='ฝาก'){ depCount++; depAmt+=isFinite(amt)?amt:0; } else if(act==='ถอน'){ wdrCount++; wdrAmt+=isFinite(amt)?amt:0; } classCount.set(cls,(classCount.get(cls)||0)+1); }); let topClass='-',topClassCount=0; for(const [k,v] of classCount.entries()){ if(v>topClassCount){ topClass=k; topClassCount=v; } } const net=depAmt-wdrAmt; const text='ช่วงข้อมูล: '+thaiDateString(start)+' – '+thaiDateString(end)+'\n• ฝาก: '+depCount.toLocaleString('th-TH')+' ครั้ง (รวม '+fmtNumber(depAmt)+' บาท)\n• ถอน: '+wdrCount.toLocaleString('th-TH')+' ครั้ง (รวม '+fmtNumber(wdrAmt)+' บาท)\n• เงินไหลสุทธิ (ฝาก-ถอน): '+fmtNumber(net)+' บาท\n• ชั้นที่เคลื่อนไหวสูงสุด: '+topClass+' ('+topClassCount.toLocaleString('th-TH')+' ครั้ง)'; const div=document.createElement('div'); div.className='insight'; div.innerHTML='<strong>สรุปช่วงเวลา</strong><br>'+text.replace(/\n/g,'<br>'); return {node:div}; }
async function exportSummaryPDF(kind){ const d=parseDateRangeFilter(kind); const start=d.start, end=d.end; const wrap=buildPDFShell(kind==='week'?'สรุปรายสัปดาห์':'สรุปรายเดือน'); const insight=buildTxInsightsRange(start,end); if(insight.node) wrap.appendChild(insight.node); const classAgg=new Map(); (TX||[]).forEach(function(r){ const dd=parseThaiDate(r['วันที่']); if(!inRange(dd,start,end)) return; const cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ'); const act=String(r['รายการ']||'').trim(); const amt=toNumber(r['จำนวนเงิน']); const obj=classAgg.get(cls)||{ฝาก:0,ถอน:0,ครั้งฝาก:0,ครั้งถอน:0}; if(act==='ฝาก'){ obj.ฝาก+=isFinite(amt)?amt:0; obj.ครั้งฝาก++; } else if(act==='ถอน'){ obj.ถอน+=isFinite(amt)?amt:0; obj.ครั้งถอน++; } classAgg.set(cls,obj); }); const table=document.createElement('table'); const thead=document.createElement('thead'); thead.innerHTML='<tr><th>ชั้น</th><th>ครั้งฝาก</th><th>ครั้งถอน</th><th>รวมฝาก</th><th>รวมถอน</th><th>สุทธิ</th></tr>'; const tbody=document.createElement('tbody'); for(const [cls,v] of classAgg.entries()){ const tr=document.createElement('tr'); tr.innerHTML='<td>'+cls+'</td><td>'+fmtNumber(v.ครั้งฝาก)+'</td><td>'+fmtNumber(v.ครั้งถอน)+'</td><td>'+fmtNumber(v.ฝาก)+'</td><td>'+fmtNumber(v.ถอน)+'</td><td>'+fmtNumber(v.ฝาก - v.ถอน)+'</td>'; tbody.appendChild(tr);} table.appendChild(thead); table.appendChild(tbody); wrap.appendChild(table); addSignatureBlock(wrap); await renderPDF(wrap, 'WDBank-summary-'+kind+'-'+new Date().toISOString().slice(0,10)+'.pdf'); }
function buildClassBalanceSummary(){ const rows=Array.isArray(AC)? AC:[]; const result=new Map(); rows.forEach(function(r){ const cls=String(r['ห้อง']||r['ชั้น']||'ไม่ระบุ'); const dep=toNumber(r['ฝาก']); const wdr=toNumber(r['ถอน']); const bal=toNumber(r['จำนวนเงินคงเหลือ']); const depC=toNumber(r['จำนวนครั้งที่ฝาก']); const wdrC=toNumber(r['จำนวนครั้งที่ถอน']); const obj=result.get(cls)||{ฝาก:0,ถอน:0,คงเหลือ:0,ครั้งฝาก:0,ครั้งถอน:0,บัญชี:0}; obj.ฝาก+=isFinite(dep)?dep:0; obj.ถอน+=isFinite(wdr)?wdr:0; obj.คงเหลือ+=isFinite(bal)?bal:0; obj.ครั้งฝาก+=isFinite(depC)?depC:0; obj.ครั้งถอน+=isFinite(wdrC)?wdrC:0; obj.บัญชี+=1; result.set(cls,obj); }); const table=document.createElement('table'); const thead=document.createElement('thead'); thead.innerHTML='<tr><th>ชั้น</th><th>จำนวนบัญชี</th><th>รวมฝาก</th><th>รวมถอน</th><th>คงเหลือรวม</th><th>ครั้งฝาก</th><th>ครั้งถอน</th></tr>'; const tbody=document.createElement('tbody'); for(const [cls,v] of result.entries()){ const tr=document.createElement('tr'); tr.innerHTML='<td>'+cls+'</td><td>'+fmtNumber(v.บัญชี)+'</td><td>'+fmtNumber(v.ฝาก)+'</td><td>'+fmtNumber(v.ถอน)+'</td><td>'+fmtNumber(v.คงเหลือ)+'</td><td>'+fmtNumber(v.ครั้งฝาก)+'</td><td>'+fmtNumber(v.ครั้งถอน)+'</td>'; tbody.appendChild(tr);} table.appendChild(thead); table.appendChild(tbody); return table; }
async function exportClassBalancePDF(){ const wrap=buildPDFShell('ยอดคงเหลือรวมรายชั้น'); wrap.appendChild(buildClassBalanceSummary()); addSignatureBlock(wrap); await renderPDF(wrap, 'WDBank-class-balance-'+new Date().toISOString().slice(0,10)+'.pdf'); }
async function exportSavingsPDF(){ const rows=Array.isArray(AC)? AC:[]; const filtered=rows.filter(r=>String(r['ออมสิน']||'').toUpperCase()==='TRUE'); if(!filtered.length){ return alert('ไม่มีบัญชีที่เป็นออมสิน (TRUE)'); } const wrap=buildPDFShell('บัญชีสำหรับนำฝากต่อธนาคารออมสิน'); let sumBal=0,sumDep=0,sumWdr=0,count=filtered.length; filtered.forEach(function(r){ sumBal+=isFinite(toNumber(r['จำนวนเงินคงเหลือ']))?toNumber(r['จำนวนเงินคงเหลือ']):0; sumDep+=isFinite(toNumber(r['ฝาก']))?toNumber(r['ฝาก']):0; sumWdr+=isFinite(toNumber(r['ถอน']))?toNumber(r['ถอน']):0; }); const info=document.createElement('div'); info.className='insight'; info.innerHTML='<strong>สรุป</strong><br>จำนวนนำส่ง: '+fmtNumber(count)+' บัญชี<br>รวมฝาก: '+fmtNumber(sumDep)+' บาท • รวมถอน: '+fmtNumber(sumWdr)+' บาท<br>คงเหลือรวม: '+fmtNumber(sumBal)+' บาท'; wrap.appendChild(info); const headers=['บัญชี','ห้อง','ฝาก','ถอน','จำนวนเงินคงเหลือ','สถานะบัญชี']; const rowsOut=filtered.map(function(r){ return {'บัญชี':formatAccountMasked(r['รหัสนักเรียน']||r['บัญชี']||''),'ห้อง':r['ห้อง']||r['ชั้น']||'','ฝาก':fmtNumber(r['ฝาก']),'ถอน':fmtNumber(r['ถอน']),'จำนวนเงินคงเหลือ':fmtNumber(r['จำนวนเงินคงเหลือ']),'สถานะบัญชี':r['สถานะบัญชี']||''}; }); wrap.appendChild(buildPDFTable(headers, rowsOut)); addSignatureBlock(wrap); await renderPDF(wrap, 'WDBank-savings-gsb-'+new Date().toISOString().slice(0,10)+'.pdf'); }

// Leaderboard + Charts
function parseTermStr(s){ s=String(s||'').trim(); if(!s || s.indexOf('/')<0) return null; var parts=s.split('/'); var t=parseInt(parts[0],10); var y=parseInt(parts[1],10); if(isNaN(t)||isNaN(y)) return null; return {term:t,year:y}; }
function latestTermFromTX(){ var terms = Array.from(new Set((TX||[]).map(r=>String(r['ปีการศึกษา']||'').trim()).filter(Boolean))); if(!terms.length) return null; var parsed = terms.map(function(s){return {s:s,p:parseTermStr(s)};}).filter(x=>!!x.p); parsed.sort(function(a,b){ if(a.p.year!==b.p.year) return b.p.year - a.p.year; return b.p.term - a.p.term; }); return parsed.length? parsed[0].s : null; }
function getRangeByScope(scope){ if(scope==='term'){ var t=latestTermFromTX(); return {type:'term',value:t}; } var now=new Date(); if(scope==='week'){ var start=new Date(now); var day=(now.getDay()+6)%7; start.setDate(now.getDate()-day); start.setHours(0,0,0,0); var end=new Date(start); end.setDate(start.getDate()+7); return {type:'range',start:start,end:end}; } var startM=new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0); var endM=new Date(now.getFullYear(), now.getMonth()+1, 1, 0,0,0,0); return {type:'range',start:startM,end:endM}; }
function inScopeTx(r,scopeObj){ if(scopeObj.type==='term'){ var term=String(r['ปีการศึกษา']||'').trim(); return term===scopeObj.value; } else { var d=parseThaiDate(r['วันที่']); return inRange(d, scopeObj.start, scopeObj.end); } }
function aggregateClass(scope){ var scopeObj=getRangeByScope(scope); var agg=new Map(); (TX||[]).forEach(function(r){ if(!inScopeTx(r,scopeObj)) return; var cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ'); var act=String(r['รายการ']||'').trim(); var amt=toNumber(r['จำนวนเงิน']); var obj=agg.get(cls)||{depC:0,wdrC:0,dep:0,wdr:0}; if(act==='ฝาก'){ obj.depC++; obj.dep+=isFinite(amt)?amt:0; } else if(act==='ถอน'){ obj.wdrC++; obj.wdr+=isFinite(amt)?amt:0; } agg.set(cls,obj); }); var rows=[]; agg.forEach(function(v,k){ rows.push({ชั้น:k,ครั้งฝาก:v.depC,ครั้งถอน:v.wdrC,รวมฝาก:v.dep,รวมถอน:v.wdr,สุทธิ:(v.dep-v.wdr)}); }); rows.sort(function(a,b){ return b.สุทธิ - a.สุทธิ; }); return rows; }
function renderLeaderboard(scope){ var rows=aggregateClass(scope); var body=document.getElementById('leader-body'); body.innerHTML=''; if(!rows.length){ body.innerHTML='<tr><td colspan="6">ไม่พบข้อมูล</td></tr>'; return; } rows.forEach(function(r){ var tr=document.createElement('tr'); tr.innerHTML='<td>'+r.ชั้น+'</td><td>'+fmtNumber(r.ครั้งฝาก)+'</td><td>'+fmtNumber(r.ครั้งถอน)+'</td><td>'+fmtNumber(r.รวมฝาก)+'</td><td>'+fmtNumber(r.รวมถอน)+'</td><td>'+fmtNumber(r.สุทธิ)+'</td>'; body.appendChild(tr); }); }

let _barChart=null,_lineChart=null;
function buildCharts(scope){ var scopeObj=getRangeByScope(scope); var byClass=new Map(); (TX||[]).forEach(function(r){ if(!inScopeTx(r,scopeObj)) return; var cls=String(r['ชั้น']||r['ห้อง']||'ไม่ระบุ'); var act=String(r['รายการ']||'').trim(); var amt=toNumber(r['จำนวนเงิน']); var obj=byClass.get(cls)||{dep:0,wdr:0}; if(act==='ฝาก') obj.dep+=isFinite(amt)?amt:0; else if(act==='ถอน') obj.wdr+=isFinite(amt)?amt:0; byClass.set(cls,obj); }); var labels=Array.from(byClass.keys()); var depArr=labels.map(l=>byClass.get(l).dep); var wdrArr=labels.map(l=>byClass.get(l).wdr); var pairs=labels.map((l,i)=>({l:l,sum:depArr[i]+wdrArr[i],dep:depArr[i],wdr:wdrArr[i]})); pairs.sort((a,b)=>b.sum-a.sum); pairs=pairs.slice(0,8); labels=pairs.map(p=>p.l); depArr=pairs.map(p=>p.dep); wdrArr=pairs.map(p=>p.wdr);
  var ctxB=document.getElementById('chartBar').getContext('2d'); if(_barChart){ _barChart.destroy(); } _barChart=new Chart(ctxB,{type:'bar',data:{labels:labels,datasets:[{label:'รวมฝาก',data:depArr},{label:'รวมถอน',data:wdrArr}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top'}},scales:{x:{ticks:{maxRotation:0,autoSkip:true}}}}});
  var byDay=new Map(); (TX||[]).forEach(function(r){ if(!inScopeTx(r,scopeObj)) return; var d=parseThaiDate(r['วันที่']); if(!d) return; var k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); var act=String(r['รายการ']||'').trim(); var amt=toNumber(r['จำนวนเงิน']); var o=byDay.get(k)||{dep:0,wdr:0}; if(act==='ฝาก') o.dep+=isFinite(amt)?amt:0; else if(act==='ถอน') o.wdr+=isFinite(amt)?amt:0; byDay.set(k,o); }); var days=Array.from(byDay.keys()).sort(); var depD=days.map(k=>byDay.get(k).dep); var wdrD=days.map(k=>byDay.get(k).wdr); var ctxL=document.getElementById('chartLine').getContext('2d'); if(_lineChart){ _lineChart.destroy(); } _lineChart=new Chart(ctxL,{type:'line',data:{labels:days,datasets:[{label:'ฝาก',data:depD},{label:'ถอน',data:wdrD}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top'}}}});
}

// Leaderboard PDF
async function exportLeaderboardPDF(scope){ var titleMap={week:'ลีดเดอร์บอร์ดระดับชั้น • สัปดาห์นี้', month:'ลีดเดอร์บอร์ดระดับชั้น • เดือนนี้', term:'ลีดเดอร์บอร์ดระดับชั้น • เทอมนี้'}; var rows=aggregateClass(scope); if(!(rows && rows.length)){ alert('ไม่มีข้อมูลสำหรับรายงาน'); return; } var headers=['ชั้น','ครั้งฝาก','ครั้งถอน','รวมฝาก','รวมถอน','สุทธิ']; var dataRows=rows.map(function(r){ return {'ชั้น':r.ชั้น,'ครั้งฝาก':r.ครั้งฝาก,'ครั้งถอน':r.ครั้งถอน,'รวมฝาก':r.รวมฝาก,'รวมถอน':r.รวมถอน,'สุทธิ':r.สุทธิ}; }); var wrap=buildPDFShell(titleMap[scope]||'ลีดเดอร์บอร์ดระดับชั้น'); wrap.appendChild(buildPDFTable(headers, dataRows)); addSignatureBlock(wrap); await renderPDF(wrap, 'WDBank-leaderboard-'+scope+'-'+new Date().toISOString().slice(0,10)+'.pdf'); }

// Setup
function setupTabs(){ document.querySelectorAll('.tab').forEach(function(btn){ btn.addEventListener('click', function(){ document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active')); document.querySelectorAll('.panel').forEach(p=>p.classList.remove('show')); btn.classList.add('active'); document.getElementById('panel-'+btn.dataset.tab).classList.add('show'); }); }); }
function switchView(view){ document.querySelectorAll('.view').forEach(v=>v.classList.remove('show')); document.getElementById('view-'+view).classList.add('show'); document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===view)); }
function setupBottomNav(){ document.querySelectorAll('.nav-btn').forEach(b=>{ b.addEventListener('click', ()=>switchView(b.dataset.view)); }); }
function setupReportHub(){ document.getElementById('hub-week').addEventListener('click', ()=>exportSummaryPDF('week')); document.getElementById('hub-month').addEventListener('click', ()=>exportSummaryPDF('month')); document.getElementById('hub-classsum').addEventListener('click', exportClassBalancePDF); document.getElementById('hub-savings').addEventListener('click', exportSavingsPDF); document.getElementById('hub-amount').addEventListener('click', ()=>exportPDF('amount')); document.getElementById('hub-frequent').addEventListener('click', ()=>exportPDF('frequent')); document.getElementById('hub-depositonly').addEventListener('click', ()=>exportPDF('depositonly')); }
function setupShareQuick(){ document.getElementById('share-amount-quick').addEventListener('click', shareAmount); document.getElementById('share-frequent-quick').addEventListener('click', shareFrequent); document.getElementById('share-depositonly-quick').addEventListener('click', shareDepositOnly); document.getElementById('share-allstars-quick').addEventListener('click', shareAllStars); }
function setupLeaderboard(){ renderLeaderboard('week'); document.querySelectorAll('#view-leaderboard .pill').forEach(function(btn){ btn.addEventListener('click', function(){ document.querySelectorAll('#view-leaderboard .pill').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderLeaderboard(btn.dataset.scope); }); }); }
function setupCharts(){ buildCharts('week'); document.querySelectorAll('#chartScope .pill').forEach(function(btn){ btn.addEventListener('click', function(){ document.querySelectorAll('#chartScope .pill').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); buildCharts(btn.dataset.scope); }); }); }
function setupLeaderboardPDFButtons(){ var w=document.getElementById('lb-pdf-week'); var m=document.getElementById('lb-pdf-month'); var t=document.getElementById('lb-pdf-term'); if(w) w.addEventListener('click', function(){ exportLeaderboardPDF('week'); }); if(m) m.addEventListener('click', function(){ exportLeaderboardPDF('month'); }); if(t) t.addEventListener('click', function(){ exportLeaderboardPDF('term'); }); }

document.addEventListener('DOMContentLoaded', function(){ loadAll().then(()=>{ setupLeaderboard(); setupCharts(); setupLeaderboardPDFButtons(); }); loadProfileAvatar(); setupTabs(); setupBottomNav(); setupReportHub(); setupShareQuick(); });

console.log('WDBank v6.4.1 loaded');
