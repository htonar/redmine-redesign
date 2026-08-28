/**
 * Период для раздела «Отчёты» (issue #58): пресеты + произвольный диапазон.
 * Влияет и на разбивки задач (по created_on), и на отчёт по времени
 * (по spent_on).
 */

export type ReportPeriodPreset =
  | "all"
  | "this-month"
  | "last-month"
  | "this-year"
  | "custom";

export interface ReportPeriodValue {
  preset: ReportPeriodPreset;
  /** YYYY-MM-DD, используются только при preset === "custom". */
  customFrom?: string;
  customTo?: string;
}

export interface ResolvedReportPeriod {
  from?: string;
  to?: string;
  label: string;
}

const MONTHS = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function resolveReportPeriod(
  value: ReportPeriodValue,
  now: Date = new Date(),
): ResolvedReportPeriod {
  switch (value.preset) {
    case "this-month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        from: iso(from),
        to: iso(to),
        label: `${MONTHS[from.getMonth()]} ${from.getFullYear()}`,
      };
    }
    case "last-month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        from: iso(from),
        to: iso(to),
        label: `${MONTHS[from.getMonth()]} ${from.getFullYear()}`,
      };
    }
    case "this-year": {
      const from = new Date(now.getFullYear(), 0, 1);
      const to = new Date(now.getFullYear(), 11, 31);
      return { from: iso(from), to: iso(to), label: `${from.getFullYear()}` };
    }
    case "custom": {
      const { customFrom, customTo } = value;
      if (!customFrom && !customTo) return { label: "Произвольный период" };
      return {
        from: customFrom || undefined,
        to: customTo || undefined,
        label:
          customFrom && customTo
            ? `${customFrom} – ${customTo}`
            : customFrom
              ? `с ${customFrom}`
              : `по ${customTo}`,
      };
    }
    default:
      return { label: "Всё время" };
  }
}

export const REPORT_PERIOD_PRESETS: {
  value: ReportPeriodPreset;
  label: string;
}[] = [
  { value: "all", label: "Всё время" },
  { value: "this-month", label: "Этот месяц" },
  { value: "last-month", label: "Прошлый месяц" },
  { value: "this-year", label: "Этот год" },
  { value: "custom", label: "Произвольный период" },
];
