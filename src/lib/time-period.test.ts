import { describe, expect, it } from "vitest";
import { resolvePeriod, widgetWeekOffset } from "@/lib/time-period";

// Пятница 2026-08-28.
const now = new Date(2026, 7, 28);

describe("resolvePeriod", () => {
  it("неделя, offset 0 - Пн..Вс текущей недели", () => {
    const r = resolvePeriod("week", 0, now);
    expect(r.from).toBe("2026-08-24");
    expect(r.to).toBe("2026-08-30");
    expect(r.label).toBe("24–30 авг");
  });

  it("неделя, offset -1 - предыдущая неделя", () => {
    const r = resolvePeriod("week", -1, now);
    expect(r.from).toBe("2026-08-17");
    expect(r.to).toBe("2026-08-23");
  });

  it("неделя на стыке месяцев - подпись с двумя месяцами", () => {
    const r = resolvePeriod("week", 1, now);
    expect(r.from).toBe("2026-08-31");
    expect(r.to).toBe("2026-09-06");
    expect(r.label).toBe("31 авг – 6 сен");
  });

  it("месяц, offset 0 - весь текущий месяц", () => {
    const r = resolvePeriod("month", 0, now);
    expect(r.from).toBe("2026-08-01");
    expect(r.to).toBe("2026-08-31");
    expect(r.label).toBe("авг 2026");
  });

  it("месяц, offset -8 - переход через год", () => {
    const r = resolvePeriod("month", -8, now);
    expect(r.from).toBe("2025-12-01");
    expect(r.to).toBe("2025-12-31");
    expect(r.label).toBe("дек 2025");
  });

  it("всё время - без диапазона", () => {
    const r = resolvePeriod("all", 3, now);
    expect(r.from).toBeUndefined();
    expect(r.to).toBeUndefined();
    expect(r.label).toBe("Всё время");
  });
});

describe("widgetWeekOffset", () => {
  it("в режиме недели передаёт offset как есть", () => {
    expect(widgetWeekOffset("week", -2)).toBe(-2);
  });
  it("вне режима недели - всегда текущая неделя", () => {
    expect(widgetWeekOffset("month", -2)).toBe(0);
    expect(widgetWeekOffset("all", 5)).toBe(0);
  });
});
