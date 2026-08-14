import type { IssueSummary } from "@/api/issues";

/**
 * Уведомления по своим/наблюдаемым задачам (issue #3). REST API Redmine не
 * даёт push/websocket - поэтому "живое" поведение реализуется поллингом
 * (см. useNotifications.ts): раз в интервал забираем свежий срез задач
 * (assigned_to_id=me + watcher_id=me) и сравниваем с снэпшотом прошлого
 * опроса. Эта функция - вся сравнивающая логика, без React/таймеров/
 * localStorage, чтобы её можно было гонять юнит-тестами (CLAUDE.md, TDD).
 */

export type NotificationTrigger =
  | "assigned"
  | "status_changed"
  | "activity"
  | "due_soon";

export interface IssueSnapshot {
  statusId: number;
  statusName: string;
  isClosed: boolean;
  /** null - задача ни на кого не назначена. */
  assignedToId: number | null;
  /** ISO-дата (YYYY-MM-DD) или null, как в issue.due_date. */
  dueDate: string | null;
  updatedOn: string;
}

export interface AppNotification {
  id: string;
  issueId: number;
  issueSubject: string;
  trigger: NotificationTrigger;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface DiffIssuesInput {
  previousSnapshots: Record<number, IssueSnapshot>;
  /** issueId -> due_date, на который уже уведомляли - чтобы не дублировать каждый опрос. */
  notifiedDue: Record<number, string>;
  assignedIssues: IssueSummary[];
  watchedIssues: IssueSummary[];
  currentUserId: number;
  /** За сколько дней до дедлайна начинать напоминать. */
  dueSoonDays: number;
  /**
   * Самый первый опрос после логина/включения - только сидирует снэпшоты,
   * ничего не показывает пользователю (иначе первый заход зафлудит
   * уведомлениями про всё, что уже было). notifiedDue при этом не трогаем,
   * чтобы уже близкий на момент логина дедлайн всё же напомнил о себе на
   * следующем реальном опросе, а не молчал до изменения даты.
   */
  isFirstPoll: boolean;
  /** Текущее время - инжектируется, чтобы функция была детерминированной в тестах. */
  now: Date;
}

export interface DiffIssuesResult {
  notifications: AppNotification[];
  snapshots: Record<number, IssueSnapshot>;
  notifiedDue: Record<number, string>;
}

/**
 * Настройки уведомлений (issue #4) - персистятся через usePersistedState
 * (ключ "notification-settings", по образцу issue #6), не отдельным
 * localStorage-модулем, потому что это просто объект без merge-логики поверх
 * MAX_NOTIFICATIONS и т.п. (см. notifications-storage.ts для контраста).
 */
export interface NotificationSettings {
  /** Общий выключатель - false останавливает опрос совсем, но не стирает уже полученные уведомления. */
  enabled: boolean;
  triggers: Record<NotificationTrigger, boolean>;
  /** Интервал опроса Redmine, в минутах. Дефолт - середина диапазона 5-10 из issue #3. */
  intervalMinutes: number;
  /** Десктоп-сборка (Tauri) - OS push отдельно от in-app бейджа. В вебе не влияет ни на что (see os-notifications.ts). */
  osPushEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  triggers: {
    assigned: true,
    status_changed: true,
    activity: true,
    due_soon: true,
  },
  intervalMinutes: 7,
  osPushEnabled: true,
};

export const NOTIFICATION_TRIGGER_LABELS: Record<NotificationTrigger, string> = {
  assigned: "Новая задача",
  status_changed: "Статус изменился",
  activity: "Новая активность",
  due_soon: "Дедлайн приближается",
};

/**
 * Отфильтровывает уведомления по выключенным триггерам (issue #4) - снэпшоты
 * и notifiedDue из diffIssuesForNotifications применяются как есть, чтобы
 * диф оставался консистентным при последующем включении триггера обратно;
 * фильтруется только то, что реально показывается пользователю/шлется в OS.
 */
export function filterNotificationsByTriggers(
  notifications: AppNotification[],
  triggers: Record<NotificationTrigger, boolean>,
): AppNotification[] {
  return notifications.filter((n) => triggers[n.trigger]);
}

function buildSnapshot(issue: IssueSummary): IssueSnapshot {
  return {
    statusId: issue.status?.id ?? 0,
    statusName: issue.status?.name ?? "",
    isClosed: issue.status?.is_closed ?? false,
    assignedToId: issue.assigned_to?.id ?? null,
    dueDate: issue.due_date ?? null,
    updatedOn: issue.updated_on ?? "",
  };
}

function daysUntil(dateStr: string, now: Date): number {
  const due = new Date(`${dateStr}T00:00:00Z`);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function makeNotification(
  issue: IssueSummary,
  trigger: NotificationTrigger,
  message: string,
  now: Date,
): AppNotification {
  return {
    id: `${issue.id}-${trigger}-${now.getTime()}`,
    issueId: issue.id,
    issueSubject: issue.subject,
    trigger,
    message,
    createdAt: now.toISOString(),
    read: false,
  };
}

/**
 * Сравнивает текущий срез задач (assigned + watched) с прошлым снэпшотом и
 * решает, какие из 4 триггеров issue #3 сработали. Возвращает не только
 * уведомления, но и обновлённые снэпшоты/notifiedDue - персист этого
 * состояния делает вызывающий код (notifications-storage.ts).
 */
export function diffIssuesForNotifications(input: DiffIssuesInput): DiffIssuesResult {
  const {
    previousSnapshots,
    notifiedDue,
    assignedIssues,
    watchedIssues,
    currentUserId,
    dueSoonDays,
    isFirstPoll,
    now,
  } = input;

  // Одна и та же задача может одновременно быть "своей" и наблюдаемой -
  // сливаем по id, чтобы не обработать её дважды.
  const combined = new Map<number, IssueSummary>();
  for (const issue of watchedIssues) combined.set(issue.id, issue);
  for (const issue of assignedIssues) combined.set(issue.id, issue);

  const notifications: AppNotification[] = [];
  const snapshots: Record<number, IssueSnapshot> = {};
  const nextNotifiedDue: Record<number, string> = {};

  for (const issue of combined.values()) {
    const snapshot = buildSnapshot(issue);
    snapshots[issue.id] = snapshot;

    const prev = previousSnapshots[issue.id];
    const isAssignedToMe = snapshot.assignedToId === currentUserId;
    const wasAssignedToMe = prev?.assignedToId === currentUserId;

    // updated_on может измениться из-за назначения/смены статуса/чего угодно
    // ещё - explained гарантирует, что "activity" не задублирует более
    // конкретный триггер за то же самое изменение.
    let explained = false;

    if (!isFirstPoll) {
      if (isAssignedToMe && !wasAssignedToMe) {
        notifications.push(
          makeNotification(
            issue,
            "assigned",
            `Задача #${issue.id} «${issue.subject}» назначена на вас.`,
            now,
          ),
        );
        explained = true;
      } else if (
        prev &&
        wasAssignedToMe &&
        isAssignedToMe &&
        prev.statusId !== snapshot.statusId
      ) {
        notifications.push(
          makeNotification(
            issue,
            "status_changed",
            `Статус задачи #${issue.id} «${issue.subject}» изменился на «${snapshot.statusName}».`,
            now,
          ),
        );
        explained = true;
      }

      if (!explained && prev && prev.updatedOn !== snapshot.updatedOn) {
        notifications.push(
          makeNotification(
            issue,
            "activity",
            `Новая активность по задаче #${issue.id} «${issue.subject}».`,
            now,
          ),
        );
      }

      if (
        isAssignedToMe &&
        !snapshot.isClosed &&
        snapshot.dueDate &&
        daysUntil(snapshot.dueDate, now) <= dueSoonDays &&
        notifiedDue[issue.id] !== snapshot.dueDate
      ) {
        notifications.push(
          makeNotification(
            issue,
            "due_soon",
            `Дедлайн задачи #${issue.id} «${issue.subject}» - ${snapshot.dueDate}.`,
            now,
          ),
        );
        nextNotifiedDue[issue.id] = snapshot.dueDate;
      } else if (notifiedDue[issue.id]) {
        // Сохраняем существующую отметку (дедлайн ещё актуален, но снова не
        // в пределах dueSoonDays на этот момент - не сбрасываем историю).
        nextNotifiedDue[issue.id] = notifiedDue[issue.id];
      }
    }
  }

  return { notifications, snapshots, notifiedDue: nextNotifiedDue };
}
