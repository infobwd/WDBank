// reader.config.js
// URL ของ OpenSheet (อ่านอย่างเดียว)
export const OPENSHEET_URL = "https://opensheet.elk.sh/1EZtfvb0h9wYZbRFTGcm0KVPScnyu6B-boFG6aMpWEUo/Sortรายการฝากและถอน";

// ถ้าโปรเจกต์ยังไม่มี window.GAMIFY จะเติมให้
if (!window.GAMIFY){
  window.GAMIFY = {
    MIN_DEPOSIT_TO_COUNT: 20,
    DEPOSIT_COOLDOWN_MIN: 10,
    EARLY_BIRD_HOUR: 9,
    STREAK_MODE: 'daily',
    DAILY_TARGET: 1,
    WEEKLY_ACTIVE_DAYS: 3,
    SEASON_LABEL: '2025-09',
    POINTS: { BASE_LOG10: true, BASE_FLAT: 3, BONUS_EARLY_BIRD: 2, BONUS_STREAK: 5 }
  };
}
