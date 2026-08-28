import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "@/lib/relative-time";

const now = new Date("2026-08-28T15:00:00");
const at = (offsetSec: number) =>
  new Date(now.getTime() + offsetSec * 1000).toISOString();

describe("formatRelativeTime", () => {
  it("минуты/часы назад", () => {
    expect(formatRelativeTime(at(-90), now)).toMatch(/минут/);
    expect(formatRelativeTime(at(-3 * 3600), now)).toMatch(/час/);
  });

  it("несколько секунд -> «только что»", () => {
    expect(formatRelativeTime(at(-10), now)).toBe("только что");
  });

  it("вчера / завтра по календарным суткам", () => {
    expect(formatRelativeTime("2026-08-27T23:00:00", now)).toBe("вчера");
    expect(formatRelativeTime("2026-08-29T09:00:00", now)).toBe("завтра");
  });

  it("старше недели -> дата", () => {
    expect(formatRelativeTime("2026-08-01T10:00:00", now)).toMatch(
      /^01\.08/,
    );
  });

  it("старше недели в другом году -> дата с годом", () => {
    expect(formatRelativeTime("2025-01-15T10:00:00", now)).toMatch(/2025/);
  });
});
