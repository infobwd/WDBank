// reader.core.js — fetch + normalize + compute
import { OPENSHEET_URL } from './reader.config.js';

const TZ = 'Asia/Bangkok';

// ===== Utils =====
const toLocalDate = (isoOrStr) => {
  // รับทั้ง ISO และรูปแบบวันที่ไทยทั่วไป
  const d = new Date(isoOrStr);
  return isNaN(d) ? null : d;
};
const toYMD = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(d);
const getHour = (d) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour:'2-digit', hour12:false }).formatToParts(d).find(p=>p.type==='hour')?.value||0);

function pointsFromDeposit(amount){
  const G = window.GAMIFY || {};
  if (G.POINTS?.BASE_LOG10){
    const base = Math.max(1, Math.floor(Math.log10(Math.max(10, amount))));
    return base * 10;
  }
  return G.POINTS?.BASE_FLAT ?? 3;
}
const isEarlyBird = (d) => getHour(d) < ((window.GAMIFY && window.GAMIFY.EARLY_BIRD_HOUR) ?? 9);

// ===== Inference of columns =====

const colMapCandidates = {
  datetime: ['เวลา','วันที่','วันเวลา','timestamp','date','datetime','เวลา/วันที่','เมื่อ'],
  userId:   ['รหัส','ไอดี','user','userid','บัญชี','เลขที่','เลขนักเรียน','student id','รหัสนักเรียน'],
  name:     ['ชื่อ','ชื่อ-สกุล','ผู้ใช้','นักเรียน','student','name','ชื่อสกุล','fullname'],
  first:    ['ชือ','ชื่อ','first','fname','first name','ชื่อหน้า'],
  last:     ['นามสกุล','สกุล','lname','last name','last'],
  class:    ['ห้อง','ชั้น','ชั้นเรียน','class','room','ห้องเรียน'],
  type:     ['ประเภท','ทำรายการ','action','type','ฝาก/ถอน','สถานะ','transaction'],
  amount:   ['จำนวน','จำนวนเงิน','ยอด','ยอดเงิน','amount','เงิน','มูลค่า'],
};

function pickKey(keys, candidates){
  const lower = keys.map(k=>k.toLowerCase().trim());
  for (const cand of candidates){
    const idx = lower.findIndex(k=>k.includes(cand.toLowerCase()));
    if (idx>=0) return keys[idx];
  }
  return null;
}

function inferCols(row){
  const keys = Object.keys(row);
  const m = {
    datetime: pickKey(keys, colMapCandidates.datetime),
    userId:   pickKey(keys, colMapCandidates.userId),
    name:     pickKey(keys, colMapCandidates.name),
    first:    pickKey(keys, colMapCandidates.first),
    last:     pickKey(keys, colMapCandidates.last),
    class:    pickKey(keys, colMapCandidates.class),
    type:     pickKey(keys, colMapCandidates.type),
    amount:   pickKey(keys, colMapCandidates.amount),
  };
  return m;
}


// ===== Fetch + compute =====
async function fetchRows(){
  const res = await fetch(OPENSHEET_URL, { cache:'no-store' });
  if (!res.ok) throw new Error('fetch failed');
  const rows = await res.json();
  return rows;
}

function normalize(rows){
  if (!rows?.length) return { entries:[], inferred:{} };
  const inferred = inferCols(rows[0]);
  const out = [];
  for (const r of rows){
    // Compose name
    let nameRaw = (inferred.name ? String(r[inferred.name]).trim() : '');
    const first = inferred.first ? String(r[inferred.first]).trim() : '';
    const last  = inferred.last  ? String(r[inferred.last]).trim()  : '';
    if (!nameRaw && (first || last)) nameRaw = (first + ' ' + last).trim();

    
      datetime: dt,
      ymd: dt ? toYMD(dt) : null,
      userId: inferred.userId ? String(r[inferred.userId]).trim() : null,
      name: nameRaw || null,
      class: inferred.class ? String(r[inferred.class]).trim() : null,
      type, amount,
    });
  }
  // เรียงตามเวลา
  out.sort((a,b)=> (a.datetime?.getTime()||0) - (b.datetime?.getTime()||0));
  return { entries: out, inferred };
}

function computeStats(entries){
  // ต่อผู้ใช้
  const G = window.GAMIFY || {};
  const byUser = new Map();
  for (const e of entries){
    if (!e.userId || !e.ymd) continue;
    if (!byUser.has(e.userId)){
      byUser.set(e.userId, { userId:e.userId, name:e.name, class:e.class, points:0, streakLen:0, days:new Set(), lastDepositYMD:null, lastYMD:null, earlyBirdCount:0, deposits:[] });
    }
    const u = byUser.get(e.userId);
    if (e.type==='deposit' && e.amount >= (G.MIN_DEPOSIT_TO_COUNT ?? 0)){
      // คะแนน
      let pts = pointsFromDeposit(e.amount);
      if (isEarlyBird(e.datetime)) { pts += (G.POINTS?.BONUS_EARLY_BIRD ?? 0); u.earlyBirdCount++; }
      // สตรีค (นับหนึ่งครั้งต่อวัน)
      if (!u.days.has(e.ymd)){
        if (u.lastYMD){
          const d1 = new Date(u.lastYMD + 'T00:00:00');
          const d2 = new Date(e.ymd + 'T00:00:00');
          const diff = (d2 - d1)/86400000;
          u.streakLen = (diff===1) ? (u.streakLen+1) : 1;
          if (diff===1 && u.streakLen>1) pts += (G.POINTS?.BONUS_STREAK ?? 0);
        } else {
          u.streakLen = 1;
        }
        u.days.add(e.ymd);
        u.lastYMD = e.ymd;
        u.lastDepositYMD = e.ymd;
      }
      u.points += pts;
      u.deposits.push(e);
    }
    if (u.name==null && e.name) u.name = e.name;
    if (u.class==null && e.class) u.class = e.class;
  }

  // ต่อห้อง
  const byClass = new Map();
  for (const [,u] of byUser){
    const key = (u.class && String(u.class).trim()) || 'ไม่ระบุห้อง';
    if (!byClass.has(key)) byClass.set(key, { class:key, totalPoints:0, avgStreak:0, members:[] });
    byClass.get(key).members.push(u);
  }
  for (const [,C] of byClass){
    C.totalPoints = C.members.reduce((s,v)=>s+v.points,0);
    C.avgStreak = C.members.length ? Math.round(C.members.reduce((s,v)=>s+v.streakLen,0)/C.members.length) : 0;
    C.members.sort((a,b)=> b.points - a.points || b.streakLen - a.streakLen || (a.name||'').localeCompare(b.name||''));
  }

  // ลีดเดอร์บอร์ดรวม
  const leaderboard = Array.from(byUser.values()).sort((a,b)=> b.points - a.points || b.streakLen - a.streakLen);

  return { byUser, byClass, leaderboard };
}

// ===== Public API =====
export const Reader = {
  async load(){
    const rows = await fetchRows();
    const { entries, inferred } = normalize(rows);
    const stats = computeStats(entries);
    return { entries, inferred, ...stats };
  }
};
