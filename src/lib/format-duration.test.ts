import { describe, expect, it } from "vitest";
import { formatDuration, msToRoundedHours } from "@/lib/format-duration";

describe("formatDuration", () => {
  it("меньше часа - М:СС", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(59 * 60_000 + 59_000)).toBe("59:59");
  });
  it("час и больше - Ч:ММ:СС", () => {
    expect(formatDuration(3_600_000)).toBe("1:00:00");
    expect(formatDuration(3_661_000)).toBe("1:01:01");
  });
  it("отрицательное - 0:00", () => {
    expect(formatDuration(-5000)).toBe("0:00");
  });
});

describe("msToRoundedHours", () => {
  it("округляет до сотых", () => {
    expect(msToRoundedHours(3_600_000)).toBe(1);
    expect(msToRoundedHours(1_800_000)).toBe(0.5);
    expect(msToRoundedHours(5_400_000)).toBe(1.5);
    expect(msToRoundedHours(60_000)).toBe(0.02);
  });
});
