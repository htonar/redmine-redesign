/**
 * Персист активного таймера учёта времени (issue #34) - localStorage по
 * baseUrl+user, чтобы таймер пережил перезагрузку и смену вкладки. Один
 * таймер на пользователя: старт по новой задаче заменяет предыдущий.
 */

export interface TimerState {
  issueId: number;
  issueSubject: string;
  projectId: number | null;
  /** ISO - момент старта; прошедшее время считается как now - startedAt. */
  startedAt: string;
}

function storageKey(baseUrl: string, userId: number): string {
  return `redmine-client:timer:${baseUrl}:${userId}`;
}

export function loadTimer(
  baseUrl: string | null,
  userId: number | undefined,
): TimerState | null {
  if (!baseUrl || !userId) return null;
  const raw = localStorage.getItem(storageKey(baseUrl, userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TimerState>;
    if (
      typeof parsed.issueId !== "number" ||
      typeof parsed.startedAt !== "string"
    ) {
      return null;
    }
    return {
      issueId: parsed.issueId,
      issueSubject: parsed.issueSubject ?? `#${parsed.issueId}`,
      projectId: typeof parsed.projectId === "number" ? parsed.projectId : null,
      startedAt: parsed.startedAt,
    };
  } catch {
    return null;
  }
}

export function saveTimer(
  baseUrl: string | null,
  userId: number | undefined,
  state: TimerState,
): void {
  if (!baseUrl || !userId) return;
  localStorage.setItem(storageKey(baseUrl, userId), JSON.stringify(state));
}

export function clearTimer(
  baseUrl: string | null,
  userId: number | undefined,
): void {
  if (!baseUrl || !userId) return;
  localStorage.removeItem(storageKey(baseUrl, userId));
}
