export type Season = "winter" | "summer";
export type RestDayType = "single" | "double" | "custom";
export type PetInfoKey = "offWork" | "payday" | "holiday" | "restDay";

export interface TimeRange {
  start: string;
  end: string;
}

export interface AppSettings {
  isFirstRun: boolean;
  workTime: {
    winter: TimeRange;
    summer: TimeRange;
    currentSeason: Season;
    switchDates: {
      toSummer: string;
      toWinter: string;
    };
  };
  breakTime: TimeRange;
  payday: {
    days: number[];
  };
  restDay: {
    type: RestDayType;
    customDays: number[];
    compBalance: number;
  };
  pet: {
    showItems: PetInfoKey[];
    opacity: number;
    position: { x: number; y: number };
    size: number;
    visible: boolean;
  };
  autoStart: boolean;
  notifications: {
    enabled: boolean;
    offWorkSound: boolean;
  };
  holidayPopup: {
    lastShownDate?: string;
    selectedExtraDays: Record<string, number>;
  };
}

export interface HolidayItem {
  date: string;
  name: string;
  isOffDay: boolean;
}

export interface HolidaySpan {
  key: string;
  name: string;
  start: string;
  end: string;
  days: number;
}

export interface DashboardState {
  work: CountdownResult;
  payday: PaydayResult;
  restDay: RestDayResult;
  holiday: HolidayResult;
}

export interface CountdownResult {
  kind: "before-work" | "to-break" | "in-break" | "to-off-work" | "after-work";
  label: string;
  seconds: number;
  display: string;
}

export interface PaydayResult {
  date: string;
  daysLeft: number;
  isToday: boolean;
  adjustedFromWeekend: boolean;
  note?: string;
}

export interface RestDayResult {
  date: string;
  daysLeft: number;
  label: string;
}

export interface HolidayResult {
  next?: HolidaySpan;
  daysLeft?: number;
  source: "network" | "cache" | "fallback";
}

export interface WorkBuddyApi {
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<AppSettings>;
  getHolidays(year: number): Promise<{ source: HolidayResult["source"]; holidays: HolidayItem[] }>;
  openSettings(): Promise<void>;
  hidePet(): Promise<void>;
  quit(): Promise<void>;
  onSettingsChanged(callback: (settings: AppSettings) => void): () => void;
}
