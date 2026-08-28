/**
 * Единая модель периода для страницы учёта времени (issue #64): и виджет
 * долга, и список записей ниже фильтруются одним контролом. «Неделя» и
 * «Месяц» листаются стрелками ◀/▶, «Всё время» - без диапазона.
 */

export type PeriodUnit = "week" | "month" | "all";

export interface ResolvedPeriod {
  /** YYYY-MM-DD, undefined для «Всё время». */
  from?: string;
  to?: string;
  label: string;
}

const SHORT_MONTHS = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

function toIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Понедельник той же недели, что и `d` (в JS 0 = воскресенье). */
function mondayOf(d: Date): Date {
  const wd = d.getDay();
  const diff = wd === 0 ? -6 : 1 - wd;
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(d.getDate() + diff);
  return monday;
}

/**
 * Разрешает выбранный период в диапазон дат и подпись. `offset` - смещение
 * от текущего периода (0 - текущий, -1 - предыдущий, ...); для `all`
 * игнорируется.
 */
export function resolvePeriod(
  unit: PeriodUnit,
  offset: number,
  now: Date = new Date(),
): ResolvedPeriod {
  if (unit === "all") {
    return { label: "Всё время" };
  }

  if (unit === "month") {
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    return {
      from: toIso(start),
      to: toIso(end),
      label: `${SHORT_MONTHS[start.getMonth()]} ${start.getFullYear()}`,
    };
  }

  // week
  const monday = mondayOf(now);
  monday.setDate(monday.getDate() + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const label = sameMonth
    ? `${monday.getDate()}–${sunday.getDate()} ${SHORT_MONTHS[monday.getMonth()]}`
    : `${monday.getDate()} ${SHORT_MONTHS[monday.getMonth()]} – ${sunday.getDate()} ${SHORT_MONTHS[sunday.getMonth()]}`;
  return { from: toIso(monday), to: toIso(sunday), label };
}

/**
 * Смещение недели для виджета долга: он всегда недельный, поэтому вне режима
 * «Неделя» показываем текущую (0).
 */
export function widgetWeekOffset(unit: PeriodUnit, offset: number): number {
  return unit === "week" ? offset : 0;
}
