import type { AppSettings } from "./types.js";

export const DEFAULT_SETTINGS: AppSettings = {
  isFirstRun: true,
  workTime: {
    winter: { start: "09:00", end: "18:00" },
    summer: { start: "08:30", end: "18:00" },
    currentSeason: "summer",
    switchDates: { toSummer: "05-01", toWinter: "10-01" }
  },
  breakTime: { start: "12:00", end: "13:30" },
  payday: { days: [15] },
  restDay: { type: "double", customDays: [], compBalance: 0 },
  pet: {
    showItems: ["offWork", "payday", "holiday"],
    opacity: 90,
    position: { x: 100, y: 100 },
    size: 120,
    visible: true
  },
  autoStart: true,
  notifications: { enabled: true, offWorkSound: false },
  holidayPopup: { selectedExtraDays: {} }
};

export const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
