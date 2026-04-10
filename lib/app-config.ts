import { prisma } from "./prisma";

// Simple in-memory cache with TTL (60 seconds) to avoid hammering the DB on every request
const cache = new Map<string, { value: string; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

async function get(key: string): Promise<string | null> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const row = await prisma.appConfig.findUnique({ where: { key } });
  if (!row) return null;

  cache.set(key, { value: row.value, expiresAt: Date.now() + CACHE_TTL_MS });
  return row.value;
}

async function set(key: string, value: string): Promise<void> {
  await prisma.appConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  // Bust cache entry
  cache.delete(key);
}

async function getNumber(key: string, fallback: number): Promise<number> {
  const val = await get(key);
  if (val === null) return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

async function getBoolean(key: string, fallback: boolean): Promise<boolean> {
  const val = await get(key);
  if (val === null) return fallback;
  return val === "true";
}

export const appConfig = {
  get,
  set,
  getNumber,
  getBoolean,

  // Typed accessors for each key
  bigDayOrderThreshold: () => getNumber("big_day_order_threshold", 10),
  releaseWindowHours: () => getNumber("release_window_hours", 3),
  restaurantNotificationEmail: () => get("restaurant_notification_email"),
  minScheduleAdvanceHours: () => getNumber("min_schedule_advance_hours", 2),
  maxScheduleDays: () => getNumber("max_schedule_days", 30),
  dayBeforeReminderEnabled: () => getBoolean("day_before_reminder_enabled", true),
  operatingHoursStart: () => get("operating_hours_start").then((v) => v ?? "10:00"),
  operatingHoursEnd: () => get("operating_hours_end").then((v) => v ?? "22:00"),
};
