// gamification.js — core logic for WDBank Gamify
export const GamifyCore = (function(){
  const GAMIFY = (window.GAMIFY) || (window.CFG && window.CFG.GAMIFY);
  if (!GAMIFY) console.warn('[Gamify] GAMIFY config not found. Please define window.GAMIFY in config.js');

  const TZ = 'Asia/Bangkok';
  const now = () => new Date();
  const toYMD = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(d);
  function getHour(d){ return Number(new Intl.DateTimeFormat('en-GB', { hour:'2-digit', hour12:false, timeZone: TZ }).formatToParts(d).find(p=>p.type==='hour')?.value||0) }

  const LS = {
    get(key, def){ try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } },
    set(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
  };
  const K = (u) => ({
    points: `gmf:${u}:points:${(GAMIFY && GAMIFY.SEASON_LABEL) || 'season'}`,
    lastDepositAt: `gmf:${u}:lastDepositAt`,
    streakDaily: `gmf:${u}:streakDaily:lastYMD`,
    streakLen: `gmf:${u}:streakDaily:len`,
    earlyBirdCount: `gmf:${u}:earlyBirdCount`,
    noWithdrawSince: `gmf:${u}:noWithdrawSince`,
    badges: `gmf:${u}:badges`
  });

  function pointsFromDeposit(amount){
    if (!GAMIFY) return 0;
    if (GAMIFY.POINTS?.BASE_LOG10){
      const base = Math.max(1, Math.floor(Math.log10(Math.max(10, amount))));
      return base * 10;
    }
    return GAMIFY.POINTS?.BASE_FLAT ?? 3;
  }
  const isEarlyBird = (d) => GAMIFY ? (getHour(d) < (GAMIFY.EARLY_BIRD_HOUR ?? 9)) : false;

  function onDeposit({ userId, amount, createdAt }){
    if (!GAMIFY || !userId || amount < (GAMIFY.MIN_DEPOSIT_TO_COUNT ?? 0)) return;

    const key = K(userId);
    const dt = createdAt ? new Date(createdAt) : now();

    const lastAt = LS.get(key.lastDepositAt, null);
    if (lastAt){
      const mins = (dt - new Date(lastAt))/60000;
      if (mins < (GAMIFY.DEPOSIT_COOLDOWN_MIN ?? 10)) return;
    }
    LS.set(key.lastDepositAt, dt.toISOString());

    let pts = pointsFromDeposit(amount);
    if (isEarlyBird(dt)){
      pts += (GAMIFY.POINTS?.BONUS_EARLY_BIRD ?? 0);
      const eb = (LS.get(key.earlyBirdCount, 0) || 0) + 1;
      LS.set(key.earlyBirdCount, eb);
    }

    const today = toYMD(dt);
    const lastYMD = LS.get(key.streakDaily, null);
    let streakLen = LS.get(key.streakLen, 0) || 0;
    if (lastYMD !== today){
      if (lastYMD){
        const d1 = new Date(`${lastYMD}T00:00:00`);
        const d2 = new Date(`${today}T00:00:00`);
        const diff = (d2 - d1) / 86400000;
        streakLen = (diff === 1) ? (streakLen + 1) : 1;
      } else streakLen = 1;
      LS.set(key.streakDaily, today);
      LS.set(key.streakLen, streakLen);
      if (streakLen > 1) pts += (GAMIFY.POINTS?.BONUS_STREAK ?? 0);
    }

    if (!LS.get(key.noWithdrawSince, null)) LS.set(key.noWithdrawSince, today);

    const cur = LS.get(key.points, 0) || 0;
    const total = cur + pts;
    LS.set(key.points, total);

    window.toast?.(`+${pts} คะแนน • สะสม ${total} ✅`) ?? console.log(`[toast] +${pts} คะแนน • สะสม ${total}`);
    _checkBadges(userId, { streakLen, earlyBirdCount: LS.get(key.earlyBirdCount, 0) });
  }

  function onWithdraw({ userId, createdAt }){
    if (!userId) return;
    const key = K(userId);
    const today = toYMD(createdAt ? new Date(createdAt) : now());
    LS.set(key.noWithdrawSince, today);
  }

  function getSummary(userId){
    if (!userId) return null;
    const key = K(userId);
    return {
      season: (GAMIFY && GAMIFY.SEASON_LABEL) || 'season',
      points: LS.get(key.points, 0) || 0,
      streakLen: LS.get(key.streakLen, 0) || 0,
      lastDepositYMD: LS.get(key.streakDaily, null),
      earlyBirdCount: LS.get(key.earlyBirdCount, 0) || 0,
      badges: LS.get(key.badges, [])
    };
  }

  function _award(userId, badgeCode){
    const key = K(userId);
    const bag = new Set(LS.get(key.badges, []));
    if (bag.has(badgeCode)) return;
    bag.add(badgeCode);
    LS.set(key.badges, Array.from(bag));
    window.toast?.(`🏅 ได้เหรียญ: ${badgeCode}`) ?? console.log(`[toast] 🏅 ${badgeCode}`);
  }
  function _checkBadges(userId, { streakLen, earlyBirdCount }){
    if (streakLen === 1) _award(userId, 'FIRST_DEPOSIT');
    if (streakLen === 7) _award(userId, 'STREAK_7');
    if (streakLen === 30) _award(userId, 'STREAK_30');
    if (earlyBirdCount === 5) _award(userId, 'EARLY_BIRD_5');
  }

  return { onDeposit, onWithdraw, getSummary };
})();