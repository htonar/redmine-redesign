/**
 * Цвета для приоритета и статуса задачи (issue #47) - Redmine REST не отдаёт
 * ни цвет, ни семантическую категорию. Что есть по факту:
 *   - приоритеты: упорядоченный enum, `/enumerations/issue_priorities.json`
 *     возвращает их по возрастанию важности, `is_default` = "обычный". Отсюда
 *     тон выводится ПО ПОЗИЦИИ - надёжно при любых названиях и любом числе
 *     уровней. Эвристика по названию - только запасной путь, если справочник
 *     не передан или приоритет в нём не найден.
 *   - статусы: кроме `is_closed` семантики нет вообще. `is_closed` - основная
 *     ось (закрыт -> серый). Раскраска открытых по названию ("отклонён" ->
 *     красный, "в работе" -> янтарный) - именно эвристика: неизвестное имя
 *     даёт нейтральный тон, т.е. в худшем случае просто "не подсвечено", а не
 *     неверный цвет.
 * Классы подобраны так, чтобы читаться в обеих темах.
 */

export type Tone =
  | "neutral"
  | "muted"
  | "info"
  | "progress"
  | "success"
  | "warning"
  | "danger";

export interface PriorityRef {
  id?: number;
  name?: string;
}

/** Элемент справочника приоритетов в порядке важности (как отдаёт API). */
export interface OrderedPriority {
  id: number;
  isDefault: boolean;
}

/** Запасная эвристика по имени (ru/en) - когда справочник недоступен. */
function priorityToneByName(name: string | undefined | null): Tone {
  const n = (name ?? "").trim().toLowerCase();
  if (/(immediate|немедленн)/.test(n)) return "danger";
  if (/(urgent|срочн)/.test(n)) return "danger";
  if (/(high|высок)/.test(n)) return "warning";
  if (/(low|низк|minor)/.test(n)) return "muted";
  return "neutral"; // Normal / Нормальный / прочее
}

/**
 * Тон приоритета. Если передан упорядоченный справочник `ordered` и приоритет
 * в нём найден по id - тон по позиции относительно дефолтного: ниже -> muted,
 * дефолт -> neutral, выше -> warning, самый верхний -> danger. Иначе - откат
 * на эвристику по имени.
 */
export function priorityTone(
  priority: PriorityRef | string | null | undefined,
  ordered?: OrderedPriority[],
): Tone {
  const ref: PriorityRef =
    typeof priority === "string" ? { name: priority } : (priority ?? {});

  if (ordered && ordered.length > 0 && ref.id != null) {
    const idx = ordered.findIndex((p) => p.id === ref.id);
    if (idx >= 0) {
      const defaultIdx = ordered.findIndex((p) => p.isDefault);
      const pivot =
        defaultIdx >= 0 ? defaultIdx : Math.floor((ordered.length - 1) / 2);
      if (idx < pivot) return "muted";
      if (idx === pivot) return "neutral";
      return idx === ordered.length - 1 ? "danger" : "warning";
    }
  }

  return priorityToneByName(ref.name);
}

export interface StatusLike {
  name?: string;
  is_closed?: boolean;
}

/**
 * Тон статуса: `is_closed` - основная ось (закрыт -> серый). Раскраска
 * открытых по названию - эвристика с нейтральным (info) фолбэком: неизвестное
 * имя не красится в неверный цвет, а просто остаётся нейтральным.
 */
export function statusTone(status: StatusLike | undefined | null): Tone {
  if (!status) return "neutral";
  const n = (status.name ?? "").trim().toLowerCase();
  if (/(rejected|отклонён|отклонен|отменён|отменен|canceled|cancelled)/.test(n))
    return "danger";
  if (/(resolved|closed|done|решён|решен|закрыт|выполнен)/.test(n)) {
    return status.is_closed ? "muted" : "success";
  }
  if (status.is_closed) return "muted";
  if (/(progress|в работе|in review|на ревью|тестир|feedback|обратн)/.test(n)) {
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

/** Классы для заливки бара в разбивках отчёта (issue #59) по тону. */
export const TONE_BAR_CLASS: Record<Tone, string> = {
  neutral: "bg-primary/70",
  muted: "bg-muted-foreground/40",
  info: "bg-sky-500",
  progress: "bg-amber-500",
  success: "bg-emerald-500",
  warning: "bg-orange-500",
  danger: "bg-red-500",
};

export function statusBarClass(status: StatusLike | undefined | null): string {
  return TONE_BAR_CLASS[statusTone(status)];
}

export function priorityTextClass(
  priority: PriorityRef | string | undefined | null,
  ordered?: OrderedPriority[],
): string {
  return TONE_TEXT_CLASS[priorityTone(priority, ordered)];
}

export function priorityBadgeClass(
  priority: PriorityRef | string | undefined | null,
  ordered?: OrderedPriority[],
): string {
  return TONE_BADGE_CLASS[priorityTone(priority, ordered)];
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
