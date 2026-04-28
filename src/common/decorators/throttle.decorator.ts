import { Throttle, SkipThrottle } from '@nestjs/throttler';

/**
 * Auth endpointlar uchun - eng qattiq limit
 * 5 ta so'rov / 1 daqiqa
 */
export const ThrottleAuth = () =>
  Throttle({ default: { limit: 5, ttl: 60000 } });

/**
 * File upload uchun - og'ir operatsiyalar
 * 10 ta so'rov / 1 daqiqa
 */
export const ThrottleUpload = () =>
  Throttle({ default: { limit: 10, ttl: 60000 } });

/**
 * Xabar yuborish uchun - spam oldini olish
 * 30 ta so'rov / 1 daqiqa
 */
export const ThrottleMessage = () =>
  Throttle({ default: { limit: 30, ttl: 60000 } });

/**
 * Oddiy POST/PATCH/DELETE operatsiyalar uchun
 * 20 ta so'rov / 1 daqiqa
 */
export const ThrottleWrite = () =>
  Throttle({ default: { limit: 20, ttl: 60000 } });

/**
 * GET operatsiyalar uchun - ko'proq ruxsat
 * 120 ta so'rov / 1 daqiqa
 */
export const ThrottleRead = () =>
  Throttle({ default: { limit: 120, ttl: 60000 } });

/**
 * Rate limitni o'chirish (internal/health check uchun)
 */
export const NoThrottle = () => SkipThrottle();
