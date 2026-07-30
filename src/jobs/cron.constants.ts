/**
 * Cron distributed-lock TTL. Barcha instance'lar cron'ni ayni soniyada firing
 * qiladi — birinchi lock olgan bajaradi, qolganlari o'tkazib yuboradi. TTL
 * shu bir zumlik poygani qoplashga yetadi va keyingi kunlik ishga tushishdan
 * ancha oldin tugaydi (10 daqiqa job davomiyligidan ham katta).
 */
export const CRON_LOCK_TTL_MS = 10 * 60 * 1000;
