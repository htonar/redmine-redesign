import type { AppNotification, IssueSnapshot } from "@/lib/notifications";

/**
 * Персист состояния уведомлений (issue #3) - снэпшоты задач для диффа
 * (notifications.ts), уже отправленные напоминания о дедлайне и сам список
 * уведомлений. Не сущность Redmine - localStorage, по образцу
 * issue-views-storage.ts / persisted-state-storage.ts. Ключ включает baseUrl
 * и id пользователя - состояние одного Redmine-аккаунта не должно
 * просачиваться в другой при переключении логина на этом же устройстве.
 */

export interface NotificationsState {
  snapshots: Record<number, IssueSnapshot>;
  notifiedDue: Record<number, string>;
  notifications: AppNotification[];
  /** Был ли уже хоть один опрос - см. diffIssuesForNotifications, isFirstPoll. */
  hasPolledBefore: boolean;
}

/** Сколько последних уведомлений храним - старые вытесняются, не растим localStorage бесконечно. */
const MAX_NOTIFICATIONS = 50;

function storageKey(baseUrl: string, userId: number): string {
  return `redmine-client:notifications:${baseUrl}:${userId}`;
}

function emptyState(): NotificationsState {
  return { snapshots: {}, notifiedDue: {}, notifications: [], hasPolledBefore: false };
}

export function loadNotificationsState(baseUrl: string, userId: number): NotificationsState {
  const raw = localStorage.getItem(storageKey(baseUrl, userId));
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyState();
    return {
      snapshots: parsed.snapshots ?? {},
      notifiedDue: parsed.notifiedDue ?? {},
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      hasPolledBefore: Boolean(parsed.hasPolledBefore),
    };
  } catch {
    return emptyState();
  }
}

export function saveNotificationsState(
  baseUrl: string,
  userId: number,
  state: NotificationsState,
): void {
  localStorage.setItem(storageKey(baseUrl, userId), JSON.stringify(state));
}

/** Новые уведомления - в начало списка, список капается на MAX_NOTIFICATIONS. */
export function mergeNotifications(
  existing: AppNotification[],
  incoming: AppNotification[],
): AppNotification[] {
  if (incoming.length === 0) return existing;
  return [...incoming, ...existing].slice(0, MAX_NOTIFICATIONS);
}

export function markNotificationRead(
  notifications: AppNotification[],
  id: string,
): AppNotification[] {
  return notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
}

export function markAllNotificationsRead(notifications: AppNotification[]): AppNotification[] {
  return notifications.map((n) => (n.read ? n : { ...n, read: true }));
}
