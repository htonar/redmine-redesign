import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";
import { listTimeEntries } from "@/api/timeEntries";

/** Норма часов на будний день - см. CLAUDE.md, "Мини-виджет долга по трудозатратам". */
export const DAILY_TARGET_HOURS = 8;

export interface DayDebt {
  /** YYYY-MM-DD. */
  date: string;
  /** Пн/Вт/... */
  weekdayLabel: string;
  hoursLogged: number;
  isFuture: boolean;
  isToday: boolean;
  /** Сб/Вс - нормы нет, в долг не считаются. */
  isWeekend: boolean;
  /** Недотрекано (0, если план выполнен, день ещё не наступил или это выходной). */
  deficit: number;
}

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function toIsoDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Понедельник той же недели, что и `d` (0 = воскресенье в JS Date). */
function mondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}

const SHORT_MONTHS = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

/**
 * Дни недели с фактически залогированными часами и "долгом" по норме 8ч на
 * будний день (Пн-Пт). Выходные (Сб/Вс) показываются, если в них есть
 * залогированное время, но в долг не идут. `weekOffset` - смещение недели
 * от текущей (0 - эта, -1 - прошлая, +1 - следующая); для offset != 0
 * запрашиваем явный диапазон дат вместо шортката `w`.
 */
export function useWeeklyTimeDebt(
  client: RedmineClient | null,
  weekOffset = 0,
) {
  const [days, setDays] = useState<DayDebt[]>([]);
  const [rangeLabel, setRangeLabel] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!client) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = toIsoDate(today);

    const monday = mondayOf(today);
    monday.setDate(monday.getDate() + weekOffset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const mondayIso = toIsoDate(monday);
    const sundayIso = toIsoDate(sunday);

    setRangeLabel(
      `${monday.getDate()} ${SHORT_MONTHS[monday.getMonth()]} - ${sunday.getDate()} ${SHORT_MONTHS[sunday.getMonth()]}`,
    );

    listTimeEntries(client, {
      scope: "me",
      from: mondayIso,
      to: sundayIso,
      offset: 0,
      limit: 100,
    })
      .then(({ entries }) => {
        if (cancelled) return;

        const hoursByDate = new Map<string, number>();
        for (const entry of entries) {
          hoursByDate.set(
            entry.spent_on,
            (hoursByDate.get(entry.spent_on) ?? 0) + entry.hours,
          );
        }

        const result: DayDebt[] = WEEKDAY_LABELS.map((label, i) => {
          const date = new Date(monday);
          date.setDate(monday.getDate() + i);
          const iso = toIsoDate(date);
          const isFuture = iso > todayIso;
          const isWeekend = i >= 5;
          const hoursLogged = hoursByDate.get(iso) ?? 0;
          return {
            date: iso,
            weekdayLabel: label,
            hoursLogged,
            isFuture,
            isToday: iso === todayIso,
            isWeekend,
            deficit:
              isFuture || isWeekend
                ? 0
                : Math.max(0, DAILY_TARGET_HOURS - hoursLogged),
          };
        });

        setDays(result);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e instanceof Error
            ? e.message
            : "Не удалось загрузить трудозатраты за неделю.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, weekOffset, reloadToken]);

  const totalDeficit = days.reduce((sum, d) => sum + d.deficit, 0);

  function reload() {
    setReloadToken((t) => t + 1);
  }

  return { days, totalDeficit, rangeLabel, isLoading, error, reload };
}
