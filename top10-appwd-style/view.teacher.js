// view.teacher.js — homeroom view
import { Reader } from './reader.core.js';

function el(id){ return document.getElementById(id); }
function h(html){ const d=document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }

function ensureScaffold(){
  if (el('page-gamify-teacher')) return;
  const sec = h(`<section id="page-gamify-teacher" class="hidden p-4">
    <h1 class="text-xl font-bold mb-3">Gamify — มุมมองครูประจำชั้น</h1>
    <div class="rounded-xl bg-white shadow-card p-4 mb-3 flex gap-2 items-center flex-wrap">
      <label class="text-sm">เลือกห้อง:</label>
      <select id="teacherRoom" class="border rounded-lg px-3 py-2"></select>
      <button id="btnReloadTeacher" class="px-3 py-2 rounded-lg bg-brand text-white">รีโหลดข้อมูล</button>
    </div>
    <div id="teacherSummary" class="rounded-xl bg-white shadow-card p-4 mb-3"></div>
    <div id="teacherTableWrap" class="rounded-xl bg-white shadow-card p-1 overflow-auto"></div>
  </section>`);
  document.body.appendChild(sec);
}

function renderTable(members){
  const rows = members.map((u,i)=>`
    <tr class="border-b last:border-0">
      <td class="px-3 py-2 text-slate-500">${i+1}</td>
      <td class="px-3 py-2">${u.name||'-'}</td>
      <td class="px-3 py-2">${u.userId||'-'}</td>
      <td class="px-3 py-2 text-right">${u.points}</td>
      <td class="px-3 py-2 text-right">${u.streakLen}</td>
      <td class="px-3 py-2">${u.lastDepositYMD||'-'}</td>
    </tr>`).join('');
  return `<table class="min-w-[720px] w-full text-sm">
    <thead class="bg-slate-50 text-slate-600">
      <tr>
        <th class="px-3 py-2 text-left">#</th>
        <th class="px-3 py-2 text-left">ชื่อ</th>
        <th class="px-3 py-2 text-left">รหัส</th>
        <th class="px-3 py-2 text-right">คะแนน</th>
        <th class="px-3 py-2 text-right">สตรีค</th>
        <th class="px-3 py-2 text-left">ฝากล่าสุด</th>
      </tr>
    </thead>
    <tbody>${rows||''}</tbody>
  </table>`;
}

async function loadAndRender(initialRoom=null){
  const card = el('teacherTableWrap'); const sumEl = el('teacherSummary'); const roomSel = el('teacherRoom');
  card.innerHTML = `<div class="p-6 text-slate-500">กำลังโหลดข้อมูล…</div>`;
  const data = await Reader.load();
  const classes = Array.from(data.byClass.keys()).sort((a,b)=> a.localeCompare(b, 'th'));
  roomSel.innerHTML = classes.map(c=>`<option value="${c}">${c}</option>`).join('');
  const room = initialRoom || classes[0];
  roomSel.value = room;

  const C = data.byClass.get(room);
  sumEl.innerHTML = `<div class="flex gap-6 flex-wrap text-sm">
    <div>นักเรียน: <b>${C?.members.length||0}</b></div>
    <div>คะแนนรวมห้อง: <b>${C?.totalPoints||0}</b></div>
    <div>สตรีคเฉลี่ย: <b>${C?.avgStreak||0}</b></div>
  </div>`;
  card.innerHTML = renderTable(C?.members||[]);

  roomSel.onchange = () => loadAndRender(roomSel.value);
  el('btnReloadTeacher').onclick = () => loadAndRender(roomSel.value);
}

export const TeacherView = {
  ensure(){ ensureScaffold(); },
  show(){ document.querySelectorAll('section[id^="page-"]').forEach(el=>el.classList.add('hidden')); el('page-gamify-teacher')?.classList.remove('hidden'); },
  async render(initialRoom){ await loadAndRender(initialRoom); }
};
