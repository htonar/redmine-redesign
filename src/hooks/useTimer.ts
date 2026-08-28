import { useCallback, useEffect, useState } from "react";
import {
  clearTimer,
  loadTimer,
  saveTimer,
  type TimerState,
} from "@/lib/timer-storage";
import { msToRoundedHours } from "@/lib/format-duration";

export interface TimerStartArgs {
  issueId: number;
  issueSubject: string;
  projectId: number | null;
}

export interface TimerStopResult {
  issueId: number;
  projectId: number | null;
  hours: number;
  startedAt: string;
}

/**
 * Активный таймер учёта времени (issue #34). Один на пользователя, переживает
 * перезагрузку (localStorage). Тикает раз в секунду только когда запущен -
 * чтобы обновлялся индикатор. `stop()` отдаёт округлённые часы для
 * предзаполнения диалога и НЕ создаёт запись сам.
 */
export function useTimer(baseUrl: string | null, userId: number | undefined) {
  const [timer, setTimer] = useState<TimerState | null>(() =>
    loadTimer(baseUrl, userId),
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setTimer(loadTimer(baseUrl, userId));
  }, [baseUrl, userId]);

  useEffect(() => {
    if (!timer) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timer]);

  const elapsedMs = timer
    ? Math.max(0, nowMs - new Date(timer.startedAt).getTime())
    : 0;

  const start = useCallback(
    (args: TimerStartArgs) => {
      const next: TimerState = {
        issueId: args.issueId,
        issueSubject: args.issueSubject,
        projectId: args.projectId,
        startedAt: new Date().toISOString(),
      };
      saveTimer(baseUrl, userId, next);
      setTimer(next);
    },
    [baseUrl, userId],
  );

  const stop = useCallback((): TimerStopResult | null => {
    if (!timer) return null;
    const ms = Math.max(0, Date.now() - new Date(timer.startedAt).getTime());
    clearTimer(baseUrl, userId);
    setTimer(null);
    return {
      issueId: timer.issueId,
      projectId: timer.projectId,
      hours: Math.max(0.01, msToRoundedHours(ms)),
      startedAt: timer.startedAt,
    };
  }, [timer, baseUrl, userId]);

  const cancel = useCallback(() => {
    clearTimer(baseUrl, userId);
    setTimer(null);
  }, [baseUrl, userId]);

  return { timer, elapsedMs, start, stop, cancel };
}
