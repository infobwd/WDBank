// gamify-init.js — auto installer
import './line_share.js';
import { GamifyCore } from './gamification.js';
import { GamifyUI } from './gamify-ui.js';

(function(){
  if (!window.toast){
    const t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:16px;background:#111827;color:#fff;padding:.6rem 1rem;border-radius:.75rem;z-index:9999;display:none';
    document.addEventListener('DOMContentLoaded', ()=>document.body.appendChild(t));
    window.toast = (msg)=>{ t.textContent=msg; t.style.display='block'; clearTimeout(window.__tt); window.__tt=setTimeout(()=>t.style.display='none', 1800); };
  }
  const userId = window.WDBANK_USER_ID || window.USER_ID || 'me';

  function ensureHomeCard(){
    if (document.getElementById('homeGamifyCard')) return;
    const card = document.createElement('div');
    card.id='homeGamifyCard';
    card.className='rounded-xl shadow-card p-4 bg-white';
    card.innerHTML=`<div class="flex items-center justify-between">
      <div><div class="text-sm text-slate-500">เกมมิฟายด์ ออมบ่อยได้ดาว</div>
      <div class="text-2xl font-semibold"><span id="gmfPoints">0</span> คะแนน • สตรีค <span id="gmfStreak">0</span> วัน</div></div>
      <button id="btnGoGamify" class="px-3 py-2 rounded-lg bg-brand text-white">ดูความคืบหน้า</button></div>`;
    const anchor = document.querySelector('#home, #page-home, main, body');
    anchor?.insertBefore(card, anchor.firstChild);
  }
  function ensurePage(){
    if (document.getElementById('page-gamify')) return;
    const sec=document.createElement('section');
    sec.id='page-gamify'; sec.style.display='none'; sec.className='p-4';
    sec.innerHTML=`<h1 class="text-xl font-bold mb-3">Gamify — ออมให้สนุก</h1>
    <div id="gmfSummary" class="rounded-xl shadow-card p-4 bg-white mb-3"></div>
    <div id="gmfQuests"  class="rounded-xl shadow-card p-4 bg-white mb-3"></div>
    <div id="gmfBadges"  class="rounded-xl shadow-card p-4 bg-white mb-3"></div>
    <div id="gmfRanks"   class="rounded-xl shadow-card p-4 bg-white mb-3"></div>`;
    document.body.appendChild(sec);
  }
  function bindNav(){
    const go=()=>{ document.querySelectorAll('section[id^="page-"]').forEach(el=>el.style.display='none');
      document.getElementById('page-gamify').style.display='block'; GamifyUI.renderPage(userId); };
    document.getElementById('btnGoGamify')?.addEventListener('click', go);
    window.addEventListener('hashchange', ()=>{ if (location.hash==='#gamify') go(); });
  }
  function renderHome(){ GamifyUI.renderHome(userId); }

  function hookExisting(){
    const w=window;
    if (typeof w.saveDeposit==='function'){
      const orig=w.saveDeposit;
      w.saveDeposit=async function(...args){ const tx=await orig.apply(this,args);
        try{ GamifyCore.onDeposit(tx||{userId, amount:tx?.amount??100, createdAt:new Date().toISOString()}); renderHome(); }catch(e){}
        return tx; };
    }
    if (typeof w.saveWithdraw==='function'){
      const orig=w.saveWithdraw;
      w.saveWithdraw=async function(...args){ const tx=await orig.apply(this,args);
        try{ GamifyCore.onWithdraw(tx||{userId, createdAt:new Date().toISOString()}); renderHome(); }catch(e){}
        return tx; };
    }
  }

  document.addEventListener('DOMContentLoaded', ()=>{ ensureHomeCard(); ensurePage(); bindNav(); renderHome(); hookExisting(); });
})();