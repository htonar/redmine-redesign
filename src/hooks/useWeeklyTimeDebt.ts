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
  /** Недотрекано (0, если план выполнен или день ещё не наступил). */
  deficit: number;
}

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт"];

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

/**
 * Будние дни (Пн-Пт) текущей недели с фактически залогированными часами и
 * "долгом" (сколько еще недотрекано) - конкретный сценарий пользователя:
 * норма 8ч/будний день, но трекается не каждый день, а наверстывается пачкой.
 * Дни после сегодня - `isFuture`, в долг не считаются (рано). Использует тот
 * же `GET /time_entries.json?spent_on=w` (шорткат Redmine "эта неделя"), что
 * и фильтр "Эта неделя" на TimeTrackingPage.
 */
export function useWeeklyTimeDebt(client: RedmineClient | null) {
  const [days, setDays] = useState<DayDebt[]>([]);
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
    const monday = mondayOf(today);
    const todayIso = toIsoDate(today);

    listTimeEntries(client, { scope: "me", spentOn: "w", offset: 0, limit: 100 })
      .then(({ entries }) => {
        if (cancelled) return;

        const hoursByDate = new Map<string, number>();
        for (const entry of entries) {
          hoursByDate.set(entry.spent_on, (hoursByDate.get(entry.spent_on) ?? 0) + entry.hours);
        }

        const result: DayDebt[] = WEEKDAY_LABELS.map((label, i) => {
          const date = new Date(monday);
          date.setDate(monday.getDate() + i);
          const iso = toIsoDate(date);
          const isFuture = iso > todayIso;
          const hoursLogged = hoursByDate.get(iso) ?? 0;
          return {
            date: iso,
            weekdayLabel: label,
            hoursLogged,
            isFuture,
            isToday: iso === todayIso,
            deficit: isFuture ? 0 : Math.max(0, DAILY_TARGET_HOURS - hoursLogged),
          };
        });

        setDays(result);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Не удалось загрузить трудозатраты за неделю.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // limit=100 хватает за глаза для недели одного пользователя - пагинация не нужна.
  }, [client, reloadToken]);

  const totalDeficit = days.reduce((sum, d) => sum + d.deficit, 0);

  function reload() {
    setReloadToken((t) => t + 1);
  }

  return { days, totalDeficit, isLoading, error, reload };
}
