import { DEFAULT_SETTINGS, WEEKDAYS } from "./constants.js";
import type {
  AppSettings,
  CountdownResult,
  HolidayItem,
  HolidayResult,
  HolidaySpan,
  PaydayResult,
  RestDayResult
} from "./types.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function mergeSettings(input: Partial<AppSettings> | undefined): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    workTime: { ...DEFAULT_SETTINGS.workTime, ...input?.workTime },
    breakTime: { ...DEFAULT_SETTINGS.breakTime, ...input?.breakTime },
    payday: { ...DEFAULT_SETTINGS.payday, ...input?.payday },
    restDay: { ...DEFAULT_SETTINGS.restDay, ...input?.restDay },
    pet: { ...DEFAULT_SETTINGS.pet, ...input?.pet },
    notifications: { ...DEFAULT_SETTINGS.notifications, ...input?.notifications },
    holidayPopup: { ...DEFAULT_SETTINGS.holidayPopup, ...input?.holidayPopup }
  };
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => v.toString().padStart(2, "0")).join(":");
}

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseClock(base: Date, clock: string): Date {
  const [hour, minute] = clock.split(":").map(Number);
  const value = new Date(base);
  value.setHours(hour, minute, 0, 0);
  return value;
}

export function daysBetween(start: Date, end: Date): number {
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return Math.round((b - a) / DAY_MS);
}

export function getActiveWorkRange(settings: AppSettings) {
  return settings.workTime[settings.workTime.currentSeason];
}

export function getWorkCountdown(now: Date, settings: AppSettings): CountdownResult {
  const work = getActiveWorkRange(settings);
  const start = parseClock(now, work.start);
  const end = parseClock(now, work.end);
  const breakStart = parseClock(now, settings.breakTime.start);
  const breakEnd = parseClock(now, settings.breakTime.end);

  if (now < start) {
    return {
      kind: "before-work",
      label: "还未上班，再睡会儿",
      seconds: Math.floor((start.getTime() - now.getTime()) / 1000),
      display: "还未上班，再睡会儿"
    };
  }
  if (now >= end) {
    return { kind: "after-work", label: "已下班，好好休息", seconds: 0, display: "已下班，好好休息" };
  }
  if (now < breakStart) {
    const seconds = Math.floor((breakStart.getTime() - now.getTime()) / 1000);
    return { kind: "to-break", label: "距离午休", seconds, display: formatDuration(seconds) };
  }
  if (now >= breakStart && now < breakEnd) {
    const seconds = Math.floor((breakEnd.getTime() - now.getTime()) / 1000);
    return { kind: "in-break", label: "午休剩余", seconds, display: formatDuration(seconds) };
  }
  const seconds = Math.floor((end.getTime() - now.getTime()) / 1000);
  return { kind: "to-off-work", label: "距离下班", seconds, display: formatDuration(seconds) };
}

export function adjustWeekend(date: Date): Date {
  const value = new Date(date);
  if (value.getDay() === 6) value.setDate(value.getDate() + 2);
  if (value.getDay() === 0) value.setDate(value.getDate() + 1);
  return value;
}

export function getNextPayday(now: Date, settings: AppSettings): PaydayResult {
  const days = [...new Set(settings.payday.days)].filter((day) => day >= 1 && day <= 31).sort((a, b) => a - b);
  const candidates: { original: Date; adjusted: Date }[] = [];

  for (let monthOffset = 0; monthOffset <= 2; monthOffset += 1) {
    for (const day of days.length ? days : [15]) {
      const original = new Date(now.getFullYear(), now.getMonth() + monthOffset, day);
      if (original.getMonth() !== (now.getMonth() + monthOffset) % 12) continue;
      const adjusted = adjustWeekend(original);
      if (daysBetween(now, adjusted) >= 0) candidates.push({ original, adjusted });
    }
  }

  candidates.sort((a, b) => a.adjusted.getTime() - b.adjusted.getTime());
  const next = candidates[0];
  const daysLeft = daysBetween(now, next.adjusted);
  const adjustedFromWeekend = dateKey(next.original) !== dateKey(next.adjusted);
  return {
    date: dateKey(next.adjusted),
    daysLeft,
    isToday: daysLeft === 0,
    adjustedFromWeekend,
    note: adjustedFromWeekend
      ? `发薪日遇周末，顺延至 ${next.adjusted.getMonth() + 1}月${next.adjusted.getDate()}日(${WEEKDAYS[next.adjusted.getDay()]})`
      : undefined
  };
}

export function getNextRestDay(now: Date, settings: AppSettings): RestDayResult {
  const allowed = new Set(
    settings.restDay.type === "single" ? [0] : settings.restDay.type === "double" ? [0, 6] : settings.restDay.customDays
  );

  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    if (allowed.has(candidate.getDay())) {
      return {
        date: dateKey(candidate),
        daysLeft: offset,
        label: offset === 0 ? "今天可以休息" : `距离下次休息还有 ${offset} 天`
      };
    }
  }

  const fallback = new Date(now);
  fallback.setDate(now.getDate() + 7);
  return { date: dateKey(fallback), daysLeft: 7, label: "距离下次休息还有 7 天" };
}

export function groupHolidaySpans(holidays: HolidayItem[]): HolidaySpan[] {
  const offDays = holidays
    .filter((item) => item.isOffDay)
    .sort((a, b) => a.date.localeCompare(b.date));
  const spans: HolidaySpan[] = [];

  for (const item of offDays) {
    const prev = spans.at(-1);
    const currentDate = new Date(`${item.date}T00:00:00+08:00`);
    const prevEnd = prev ? new Date(`${prev.end}T00:00:00+08:00`) : undefined;
    const continuous = prevEnd ? daysBetween(prevEnd, currentDate) === 1 && prev?.name === item.name : false;

    if (!prev || !continuous) {
      spans.push({ key: `${item.name}-${item.date}`, name: item.name, start: item.date, end: item.date, days: 1 });
    } else {
      prev.end = item.date;
      prev.days += 1;
    }
  }

  return spans;
}

export function getNextHoliday(now: Date, holidays: HolidayItem[], source: HolidayResult["source"]): HolidayResult {
  const spans = groupHolidaySpans(holidays);
  const next = spans.find((span) => daysBetween(now, new Date(`${span.end}T00:00:00+08:00`)) >= 0);
  return {
    source,
    next,
    daysLeft: next ? daysBetween(now, new Date(`${next.start}T00:00:00+08:00`)) : undefined
  };
}
