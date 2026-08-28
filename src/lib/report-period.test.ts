import { describe, expect, it } from "vitest";
import { resolveReportPeriod } from "@/lib/report-period";

const now = new Date(2026, 7, 15); // 15 авг 2026

describe("resolveReportPeriod", () => {
  it("all - без диапазона", () => {
    expect(resolveReportPeriod({ preset: "all" }, now)).toEqual({
      label: "Всё время",
    });
  });

  it("this-month", () => {
    const r = resolveReportPeriod({ preset: "this-month" }, now);
    expect(r.from).toBe("2026-08-01");
    expect(r.to).toBe("2026-08-31");
    expect(r.label).toBe("август 2026");
  });

  it("last-month - переход через год", () => {
    const r = resolveReportPeriod({ preset: "last-month" }, new Date(2026, 0, 10));
    expect(r.from).toBe("2025-12-01");
    expect(r.to).toBe("2025-12-31");
  });

  it("this-year", () => {
    const r = resolveReportPeriod({ preset: "this-year" }, now);
    expect(r.from).toBe("2026-01-01");
    expect(r.to).toBe("2026-12-31");
  });

  it("custom с обеими датами", () => {
    const r = resolveReportPeriod(
      { preset: "custom", customFrom: "2026-03-01", customTo: "2026-03-31" },
      now,
    );
    expect(r).toEqual({
      from: "2026-03-01",
      to: "2026-03-31",
      label: "2026-03-01 – 2026-03-31",
    });
  });

  it("custom только с одной границей", () => {
    expect(
      resolveReportPeriod({ preset: "custom", customFrom: "2026-03-01" }, now).to,
    ).toBeUndefined();
    expect(
      resolveReportPeriod({ preset: "custom", customTo: "2026-03-31" }, now).from,
    ).toBeUndefined();
  });

  it("custom без дат - без диапазона", () => {
    expect(resolveReportPeriod({ preset: "custom" }, now)).toEqual({
      label: "Произвольный период",
    });
  });
});
