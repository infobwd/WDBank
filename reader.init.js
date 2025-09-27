// reader.init.js — route bindings for Teacher/Admin views
import { TeacherView } from './view.teacher.js';
import { AdminView } from './view.admin.js';

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
document.addEventListener('DOMContentLoaded', ()=>{ route(); });
