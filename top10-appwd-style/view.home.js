// view.home.js — show Reader/Gamify snapshots on Home
import { Reader } from './reader.core.js';

function el(id){ return document.getElementById(id); }
function h(html){ const d=document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }


function ensureHomeBlocks(){
  if (!el('homeGamifyReader')){
    const card = h(`<section id="homeGamifyReader" class="rounded-xl shadow-card p-4 bg-white mb-4">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div class="text-sm text-slate-500">สรุปเกมออม (อ่านจากชีต)</div>
          <div class="text-lg font-semibold"><span id="hTotalStd">0</span> นักเรียน • คะแนนรวม <span id="hTotalPts">0</span> • สตรีคเฉลี่ย <span id="hAvgStreak">0</span></div>
        </div>
        <div class="flex gap-2">
          <a id="goTeacher" class="px-3 py-2 rounded-lg bg-white border">ครูประจำชั้น</a>
          <a id="goAdmin"   class="px-3 py-2 rounded-lg bg-brand text-white">ผู้บริหาร</a>
        </div>
      </div>
      <div class="mt-3">
        <label class="text-sm mr-2">ดูห้อง:</label>
        <select id="hRoom" class="border rounded-lg px-3 py-2"></select>
      </div>
      <div id="hTableWrap" class="mt-3 overflow-auto"></div>
    </section>`);
    const anchor = document.querySelector('#home, #page-home, main, body');
    anchor?.insertBefore(card, anchor.firstChild);
  }
  // Hide legacy localStorage Gamify card if present (to avoid "0 คะแนน")
  const legacy = document.getElementById('homeGamifyCard');
  if (legacy) legacy.style.display = 'none';
}

}

function renderClassTable(members){
  const rows = members.slice(0, 10).map((u,i)=>`
    <tr class="border-b last:border-0">
      <td class="px-3 py-2 text-slate-500">${i+1}</td>
      <td class="px-3 py-2">${u.name||'-'}</td>
      <td class="px-3 py-2">${u.userId||'-'}</td>
      <td class="px-3 py-2 text-right">${u.points}</td>
      <td class="px-3 py-2 text-right">${u.streakLen}</td>
    </tr>`).join('');
  return `<table class="min-w-[600px] w-full text-sm">
    <thead class="bg-slate-50 text-slate-600">
      <tr>
        <th class="px-3 py-2 text-left">#</th>
        <th class="px-3 py-2 text-left">ชื่อ</th>
        <th class="px-3 py-2 text-left">รหัส</th>
        <th class="px-3 py-2 text-right">คะแนน</th>
        <th class="px-3 py-2 text-right">สตรีค</th>
      </tr>
    </thead>
    <tbody>${rows||''}</tbody>
  </table>`;
}

async function loadAndRender(){
  ensureHomeBlocks();
  const tStd = el('hTotalStd'), tPts = el('hTotalPts'), tStk = el('hAvgStreak');
  const roomSel = el('hRoom'); const tbl = el('hTableWrap');
  if (!tStd || !roomSel) return;

  tbl.innerHTML = '<div class="p-4 text-slate-500">กำลังโหลดข้อมูล…</div>';
  const data = await Reader.load();

  const totalStd = data.leaderboard.length;
  const totalPts = data.leaderboard.reduce((s,v)=>s+v.points,0);
  const avgStreak = totalStd ? Math.round(data.leaderboard.reduce((s,v)=>s+v.streakLen,0)/totalStd) : 0;
  tStd.textContent = totalStd; tPts.textContent = totalPts; tStk.textContent = avgStreak;

  const classes = Array.from(data.byClass.keys()).sort((a,b)=> a.localeCompare(b,'th'));
  roomSel.innerHTML = classes.map(c=>`<option value="\${c}">\${c}</option>`).join('');
  const first = classes[0]; roomSel.value = first;
  const C = data.byClass.get(first);
  tbl.innerHTML = renderClassTable(C?.members||[]);

  roomSel.onchange = ()=>{
    const C2 = data.byClass.get(roomSel.value);
    tbl.innerHTML = renderClassTable(C2?.members||[]);
  };

  el('goTeacher')?.addEventListener('click', (e)=>{ e.preventDefault(); location.hash = '#gamify-teacher'; });
  el('goAdmin')?.addEventListener('click', (e)=>{ e.preventDefault(); location.hash = '#gamify-admin'; });
}

export const HomeView = { render: loadAndRender };
