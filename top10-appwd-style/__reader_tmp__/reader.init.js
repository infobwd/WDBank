// reader.init.js — route bindings for Teacher/Admin views
import { TeacherView } from './view.teacher.js';
import { AdminView } from './view.admin.js';

function ensureNavButtons(){
  // แปะปุ่มทางเข้าแบบง่าย ๆ ถ้าไม่มี
  if (!document.getElementById('btnGoTeacher')){
    const nav = document.createElement('div');
    nav.className = 'fixed bottom-4 right-4 flex gap-2';
    nav.innerHTML = `
      <a id="btnGoTeacher" class="px-3 py-2 rounded-lg bg-white border shadow-card" href="#gamify-teacher">ครูประจำชั้น</a>
      <a id="btnGoAdmin" class="px-3 py-2 rounded-lg bg-brand text-white shadow-card" href="#gamify-admin">ผู้บริหาร</a>`;
    document.body.appendChild(nav);
  }
}

function route(){
  const hash = location.hash;
  if (hash === '#gamify-teacher'){
    TeacherView.ensure(); TeacherView.show(); TeacherView.render();
  } else if (hash === '#gamify-admin'){
    AdminView.ensure(); AdminView.show(); AdminView.render();
  }
}

window.addEventListener('hashchange', route);
document.addEventListener('DOMContentLoaded', ()=>{ ensureNavButtons(); route(); });
