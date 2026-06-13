import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./constants.js";
import { getNextPayday, getWorkCountdown, groupHolidaySpans } from "./time.js";

describe("work countdown", () => {
  it("switches to lunch countdown before break", () => {
    const result = getWorkCountdown(new Date("2026-06-13T10:00:00+08:00"), DEFAULT_SETTINGS);
    expect(result.kind).toBe("to-break");
    expect(result.display).toBe("02:00:00");
  });

  it("shows lunch remaining during break", () => {
    const result = getWorkCountdown(new Date("2026-06-13T12:30:00+08:00"), DEFAULT_SETTINGS);
    expect(result.kind).toBe("in-break");
    expect(result.display).toBe("01:00:00");
  });
});

describe("payday", () => {
  it("moves weekend payday to monday", () => {
    const result = getNextPayday(new Date("2026-08-14T09:00:00+08:00"), {
      ...DEFAULT_SETTINGS,
      payday: { days: [15] }
    });
    expect(result.date).toBe("2026-08-17");
    expect(result.adjustedFromWeekend).toBe(true);
  });
});

describe("holiday spans", () => {
  it("groups adjacent off-days with the same holiday name", () => {
    const spans = groupHolidaySpans([
      { date: "2026-10-01", name: "国庆节", isOffDay: true },
      { date: "2026-10-02", name: "国庆节", isOffDay: true },
      { date: "2026-10-04", name: "国庆节", isOffDay: true }
    ]);
    expect(spans).toHaveLength(2);
    expect(spans[0].days).toBe(2);
  });
});
