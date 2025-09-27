// === GAMIFY config (append to config.js if absent) ===
window.GAMIFY = window.GAMIFY || {
  MIN_DEPOSIT_TO_COUNT: 20,
  DEPOSIT_COOLDOWN_MIN: 10,
  EARLY_BIRD_HOUR: 9,
  STREAK_MODE: 'daily',
  DAILY_TARGET: 1,
  WEEKLY_ACTIVE_DAYS: 3,
  SEASON_LABEL: '2025-09',
  POINTS: {
    BASE_LOG10: true,
    BASE_FLAT: 3,
    BONUS_EARLY_BIRD: 2,
    BONUS_STREAK: 5
  },
  BADGES: [
    { code:'FIRST_DEPOSIT',  name:'ฝากครั้งแรก' },
    { code:'STREAK_7',       name:'สตรีค 7 วัน' },
    { code:'STREAK_30',      name:'สตรีค 30 วัน' },
    { code:'NO_WITHDRAW_30', name:'ไม่ถอน 30 วัน' },
    { code:'EARLY_BIRD_5',   name:'เช้าจัด 5 ครั้ง' },
    { code:'PERFECT_MONTH',  name:'เดือนเพอร์เฟกต์' }
  ],
  QUESTS: {
    daily: [
      { code:'D_DEP_1',  name:'ฝากวันนี้ 1 ครั้ง', target:1 },
      { code:'D_SUM_200',name:'ยอดรวมวันนี้ ≥ 200 บาท', target:200, type:'sum' }
    ],
    weekly: [
      { code:'W_DAYS_3', name:'ฝาก ≥ 3 วัน ในสัปดาห์', target:3, type:'days' }
    ]
  }
};
