// view.admin.js — admin/leadership view
import { Reader } from './reader.core.js';

function el(id){ return document.getElementById(id); }
function h(html){ const d=document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }

function ensureScaffold(){
  if (el('page-gamify-admin')) return;
  const sec = h(`<section id="page-gamify-admin" class="hidden p-4">
    <h1 class="text-xl font-bold mb-3">Gamify — มุมมองผู้บริหาร</h1>
    <div class="rounded-xl bg-white shadow-card p-4 mb-3 flex gap-2 items-center flex-wrap">
      <button id="btnReloadAdmin" class="px-3 py-2 rounded-lg bg-brand text-white">รีโหลดข้อมูล</button>
    </div>
    <div id="adminSummary" class="rounded-xl bg-white shadow-card p-4 mb-3"></div>
    <div id="adminClassWrap" class="rounded-xl bg-white shadow-card p-1 overflow-auto mb-3"></div>
    <div id="adminLeaderboardWrap" class="rounded-xl bg-white shadow-card p-1 overflow-auto"></div>
  </section>`);
  document.body.appendChild(sec);
}

function renderClassTable(byClass){
  const classes = Array.from(byClass.values()).sort((a,b)=> b.totalPoints - a.totalPoints);
  const rows = classes.map((c,i)=>`
    <tr class="border-b last:border-0">
      <td class="px-3 py-2 text-slate-500">${i+1}</td>
      <td class="px-3 py-2">${c.class}</td>
      <td class="px-3 py-2 text-right">${c.members.length}</td>
      <td class="px-3 py-2 text-right">${c.totalPoints}</td>
      <td class="px-3 py-2 text-right">${c.avgStreak}</td>
    </tr>`).join('');
  return `<table class="min-w-[680px] w-full text-sm">
    <thead class="bg-slate-50 text-slate-600">
      <tr>
        <th class="px-3 py-2 text-left">#</th>
        <th class="px-3 py-2 text-left">ห้อง</th>
        <th class="px-3 py-2 text-right">จำนวนนักเรียน</th>
        <th class="px-3 py-2 text-right">คะแนนรวม</th>
        <th class="px-3 py-2 text-right">สตรีคเฉลี่ย</th>
      </tr>
    </thead>
    <tbody>${rows||''}</tbody>
  </table>`;
}

function renderLeaderboard(lb, limit=50){
  const rows = lb.slice(0, limit).map((u,i)=>`
    <tr class="border-b last:border-0">
      <td class="px-3 py-2 text-slate-500">${i+1}</td>
      <td class="px-3 py-2">${u.name||'-'}</td>
      <td class="px-3 py-2">${u.class||'-'}</td>
      <td class="px-3 py-2">${u.userId||'-'}</td>
      <td class="px-3 py-2 text-right">${u.points}</td>
      <td class="px-3 py-2 text-right">${u.streakLen}</td>
      <td class="px-3 py-2">${u.lastDepositYMD||'-'}</td>
    </tr>`).join('');
  return `<table class="min-w-[880px] w-full text-sm">
    <thead class="bg-slate-50 text-slate-600">
      <tr>
        <th class="px-3 py-2 text-left">#</th>
        <th class="px-3 py-2 text-left">ชื่อ</th>
        <th class="px-3 py-2 text-left">ห้อง</th>
        <th class="px-3 py-2 text-left">รหัส</th>
        <th class="px-3 py-2 text-right">คะแนน</th>
        <th class="px-3 py-2 text-right">สตรีค</th>
        <th class="px-3 py-2 text-left">ฝากล่าสุด</th>
      </tr>
    </thead>
    <tbody>${rows||''}</tbody>
  </table>`;
}

async function loadAndRender(){
  const sumEl = el('adminSummary'); const classWrap = el('adminClassWrap'); const lbWrap = el('adminLeaderboardWrap');
  sumEl.innerHTML = `<div class="p-6 text-slate-500">กำลังโหลดข้อมูล…</div>`;
  classWrap.innerHTML = ''; lbWrap.innerHTML='';

  const data = await Reader.load();
  const totalStd = data.leaderboard.length;
  const totalPts = data.leaderboard.reduce((s,v)=>s+v.points,0);
  const avgStreak = totalStd ? Math.round(data.leaderboard.reduce((s,v)=>s+v.streakLen,0)/totalStd) : 0;

  sumEl.innerHTML = `<div class="flex gap-6 flex-wrap text-sm">
    <div>จำนวนนักเรียนทั้งหมด: <b>${totalStd}</b></div>
    <div>คะแนนรวม: <b>${totalPts}</b></div>
    <div>สตรีคเฉลี่ย: <b>${avgStreak}</b></div>
  </div>`;

  classWrap.innerHTML = renderClassTable(data.byClass);
  lbWrap.innerHTML = renderLeaderboard(data.leaderboard, 100);
}

export const AdminView = {
  ensure(){ ensureScaffold(); },
  show(){ document.querySelectorAll('section[id^="page-"]').forEach(el=>el.classList.add('hidden')); el('page-gamify-admin')?.classList.remove('hidden'); },
  async render(){ await loadAndRender(); }
};
