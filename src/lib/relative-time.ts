/**
 * Относительное время «2 ч назад» / «вчера» / «3 дня назад» (issue #48).
 * Для дат старше недели - обычная дата. Полный timestamp пусть вызывающий
 * кладёт в title.
 */

const RU_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

export function formatRelativeTime(
  iso: string,
  now: Date = new Date(),
): string {
  const then = new Date(iso);
  const diffSec = Math.round((then.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);

  if (abs < 45) return "только что";

  // Старше недели - показываем дату, относительное «N недель назад» уже
  // не помогает ориентироваться.
  if (abs >= 7 * 24 * 3600) {
    return then.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year:
        then.getFullYear() === now.getFullYear() ? undefined : "numeric",
    });
  }

  // Спец-случай «вчера» / «завтра» по календарным суткам.
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayDiff = Math.floor(
    (then.getTime() - startOfToday.getTime()) / 86_400_000,
  );
  if (dayDiff === -1) return "вчера";
  if (dayDiff === 1) return "завтра";

  const rtf = new Intl.RelativeTimeFormat("ru", { numeric: "auto" });
  for (const [unit, secs] of RU_UNITS) {
    if (abs >= secs || unit === "minute") {
      return rtf.format(Math.round(diffSec / secs), unit);
    }
  }
  return "только что";
}

/** Полный timestamp для title при наведении. */
export function fullTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
