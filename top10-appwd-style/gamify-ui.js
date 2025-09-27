// gamify-ui.js — rendering helpers
import { GamifyCore } from './gamification.js';
export const GamifyUI = (function(){
  function renderHome(userId){
    const sum = GamifyCore.getSummary(userId);
    if (!sum) return;
    const pts = document.getElementById('gmfPoints');
    const st  = document.getElementById('gmfStreak');
    if (pts) pts.textContent = sum.points;
    if (st)  st.textContent  = sum.streakLen;
  }
  function renderPage(userId){
    const sum = GamifyCore.getSummary(userId);
    if (!sum) return;
    const el = (id)=>document.getElementById(id);
    const summary = el('gmfSummary'), quests=el('gmfQuests'), badges=el('gmfBadges'), ranks=el('gmfRanks');
    if (summary) summary.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <div class="text-slate-500 text-sm">ซีซัน: ${sum.season}</div>
          <div class="text-3xl font-bold">${sum.points} คะแนน</div>
          <div class="text-sm">สตรีค ${sum.streakLen} วัน • อัปเดตล่าสุด: ${sum.lastDepositYMD ?? '-'}</div>
        </div>
        <button id="btnShareGamify" class="px-3 py-2 rounded-lg bg-brand text-white">แชร์</button>
      </div>`;
    if (quests) quests.innerHTML = `
      <div class="font-semibold mb-2">ภารกิจวันนี้</div>
      <ul class="list-disc pl-5 text-sm">
        <li>ฝากอย่างน้อย 1 ครั้ง — <b>กำลังทำ</b></li>
        <li>ยอดรวมวันนี้ ≥ 200 บาท — <b>ยังไม่สำเร็จ</b></li>
      </ul>`;
    if (badges){
      const b = (sum.badges || []).map(c => `<span class="px-2 py-1 rounded-lg bg-slate-100 border">${c}</span>`).join(' ');
      badges.innerHTML = `<div class="font-semibold mb-2">เหรียญตราของฉัน</div>
        <div class="flex gap-2 flex-wrap text-sm">${b || '<span class="text-slate-500">ยังไม่มีเหรียญ</span>'}</div>`;
    }
    if (ranks) ranks.innerHTML = `
      <div class="font-semibold mb-2">ลีดเดอร์บอร์ด (สัปดาห์นี้)</div>
      <div class="text-sm text-slate-500">จะปรากฏเมื่อเชื่อมข้อมูลเรียลไทม์</div>`;
  }
  return { renderHome, renderPage };
})();