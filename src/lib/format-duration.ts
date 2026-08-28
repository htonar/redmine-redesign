/**
 * Длительность в «Ч:ММ:СС» / «М:СС» - для индикатора активного таймера
 * (issue #34).
 */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** Часы с округлением до сотых - что уйдёт в предзаполнение time_entry. */
export function msToRoundedHours(ms: number): number {
  return Math.round((ms / 3_600_000) * 100) / 100;
}
