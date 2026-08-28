/**
 * Цвета для приоритета и статуса задачи (issue #47) - Redmine REST не отдаёт
 * цвет ни того, ни другого, поэтому маппим по имени / is_closed. Классы
 * подобраны так, чтобы читаться в обеих темах.
 */

export type Tone =
  | "neutral"
  | "muted"
  | "info"
  | "progress"
  | "success"
  | "warning"
  | "danger";

/** Уровень приоритета по имени (ru/en, регистронезависимо). */
export function priorityTone(name: string | undefined | null): Tone {
  const n = (name ?? "").trim().toLowerCase();
  if (/(immediate|немед)/.test(n)) return "danger";
  if (/(urgent|сроч)/.test(n)) return "danger";
  if (/(high|высок)/.test(n)) return "warning";
  if (/(low|низк|minor)/.test(n)) return "muted";
  return "neutral"; // Normal / Нормальный / прочее
}

export interface StatusLike {
  name?: string;
  is_closed?: boolean;
}

/** Тон статуса: закрытые - серые, done-подобные - зелёные, отклонённые - красные и т.д. */
export function statusTone(status: StatusLike | undefined | null): Tone {
  if (!status) return "neutral";
  const n = (status.name ?? "").trim().toLowerCase();
  if (/(rejected|отклон|отмен|canceled|cancelled)/.test(n)) return "danger";
  if (/(resolved|closed|done|решён|решен|закрыт|выполн|готов)/.test(n)) {
    return status.is_closed ? "muted" : "success";
  }
  if (status.is_closed) return "muted";
  if (/(progress|работе|in review|тестир|feedback|обратн)/.test(n)) {
    return /(feedback|обратн)/.test(n) ? "info" : "progress";
  }
  return "info"; // New / Новая / прочее открытое
}

/** Классы для текста (колонка «Приоритет» в списке) по тону. */
export const TONE_TEXT_CLASS: Record<Tone, string> = {
  neutral: "text-foreground",
  muted: "text-muted-foreground",
  info: "text-sky-600 dark:text-sky-400",
  progress: "text-amber-600 dark:text-amber-400",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-orange-600 dark:text-orange-400",
  danger: "text-red-600 dark:text-red-400",
};

/** Классы для бейджа (статус) по тону - фон + текст. */
export const TONE_BADGE_CLASS: Record<Tone, string> = {
  neutral: "border-transparent bg-secondary text-secondary-foreground",
  muted: "border-transparent bg-muted text-muted-foreground",
  info: "border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-300",
  progress:
    "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
  success:
    "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warning:
    "border-transparent bg-orange-500/15 text-orange-700 dark:text-orange-300",
  danger: "border-transparent bg-red-500/15 text-red-700 dark:text-red-300",
};

export function priorityTextClass(name: string | undefined | null): string {
  return TONE_TEXT_CLASS[priorityTone(name)];
}

export function priorityBadgeClass(name: string | undefined | null): string {
  return TONE_BADGE_CLASS[priorityTone(name)];
}

export function statusBadgeClass(status: StatusLike | undefined | null): string {
  return TONE_BADGE_CLASS[statusTone(status)];
}

/**
 * Состояние срока (issue #49): просрочен / скоро / ок. Закрытые задачи -
 * всегда "ok" (срок уже неважен).
 */
export function dueDateState(
  dueDate: string | undefined | null,
  isClosed = false,
  soonDays = 3,
): "overdue" | "soon" | "ok" | null {
  if (!dueDate) return null;
  if (isClosed) return "ok";
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= soonDays) return "soon";
  return "ok";
}
