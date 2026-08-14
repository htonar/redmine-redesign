import { useCallback, useEffect, useRef, useState } from "react";
import type { RedmineClient } from "@/api/client";
import { listIssues } from "@/api/issues";
import {
  diffIssuesForNotifications,
  type AppNotification,
  type NotificationTrigger,
} from "@/lib/notifications";
import {
  loadNotificationsState,
  saveNotificationsState,
  mergeNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationsState,
} from "@/lib/notifications-storage";
import { sendOsNotification } from "@/lib/os-notifications";

/** Раз в сколько опрашиваем Redmine - середина диапазона 5-10 минут из issue #3. */
const NOTIFICATIONS_POLL_INTERVAL_MS = 7 * 60 * 1000;
/** За сколько дней до дедлайна начинаем напоминать. */
const DUE_SOON_DAYS = 3;
/** Срез задач за один опрос (assigned и watched запрашиваются отдельно). */
const ISSUES_PER_QUERY_LIMIT = 100;

const TRIGGER_TITLES: Record<NotificationTrigger, string> = {
  assigned: "Новая задача",
  status_changed: "Статус изменился",
  activity: "Новая активность",
  due_soon: "Дедлайн приближается",
};

export interface UseNotificationsResult {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const emptyState = (): NotificationsState => ({
  snapshots: {},
  notifiedDue: {},
  notifications: [],
  hasPolledBefore: false,
});

/**
 * Поллинг уведомлений (issue #3) - назначение задачи, смена статуса моей
 * задачи, активность по наблюдаемым/своим задачам, приближение дедлайна.
 * Сравнивающая логика - в notifications.ts (юнит-тесты там), персист - в
 * notifications-storage.ts; этот хук - только оркестрация (таймер + fetch +
 * побочные эффекты), по образцу useAppUpdater.ts/useActivityFeed.ts, которые
 * по той же причине не покрыты юнит-тестами.
 *
 * Интервал и dueSoonDays - пока константы, не persisted-настройка: по итогам
 * обсуждения issue #3 UI для вкл/выкл и периода опроса - отдельный
 * follow-up. Хук уже принимает только client/baseUrl/userId, так что
 * добавить enabled/intervalMs параметрами можно будет без переписывания
 * диффа и стораджа.
 */
export function useNotifications(
  client: RedmineClient | null,
  baseUrl: string | null,
  userId: number | undefined,
): UseNotificationsResult {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  // Снэпшоты/notifiedDue/hasPolledBefore не участвуют в рендере напрямую -
  // держим в ref, чтобы не пересоздавать таймер поллинга на каждое обновление.
  const pollStateRef = useRef<NotificationsState>(emptyState());

  useEffect(() => {
    if (!client || !baseUrl || !userId) return;
    // Локальные const-копии - чтобы TS сузил их до non-null и внутри
    // замыкания poll() ниже (сужение параметров эффекта в closure не держится).
    const activeClient = client;
    const activeBaseUrl = baseUrl;
    const activeUserId = userId;

    let cancelled = false;
    pollStateRef.current = loadNotificationsState(activeBaseUrl, activeUserId);
    setNotifications(pollStateRef.current.notifications);

    async function poll() {
      if (cancelled) return;
      try {
        const [assigned, watched] = await Promise.all([
          listIssues(activeClient, {
            assignee: "me",
            status: "all",
            sort: "updated_on:desc",
            offset: 0,
            limit: ISSUES_PER_QUERY_LIMIT,
          }),
          listIssues(activeClient, {
            assignee: "all",
            status: "all",
            watcher: "me",
            sort: "updated_on:desc",
            offset: 0,
            limit: ISSUES_PER_QUERY_LIMIT,
          }),
        ]);
        if (cancelled) return;

        const prev = pollStateRef.current;
        const diff = diffIssuesForNotifications({
          previousSnapshots: prev.snapshots,
          notifiedDue: prev.notifiedDue,
          assignedIssues: assigned.issues,
          watchedIssues: watched.issues,
          currentUserId: activeUserId,
          dueSoonDays: DUE_SOON_DAYS,
          isFirstPoll: !prev.hasPolledBefore,
          now: new Date(),
        });

        const nextState: NotificationsState = {
          snapshots: diff.snapshots,
          notifiedDue: diff.notifiedDue,
          notifications: mergeNotifications(prev.notifications, diff.notifications),
          hasPolledBefore: true,
        };
        pollStateRef.current = nextState;
        setNotifications(nextState.notifications);
        saveNotificationsState(activeBaseUrl, activeUserId, nextState);

        for (const notification of diff.notifications) {
          void sendOsNotification(TRIGGER_TITLES[notification.trigger], notification.message);
        }
      } catch {
        // Один неудачный опрос (сеть, 403 и т.п.) не должен ронять таймер -
        // повторим на следующем тике.
      }
    }

    void poll();
    const interval = setInterval(() => void poll(), NOTIFICATIONS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [client, baseUrl, userId]);

  const persistNotifications = useCallback(
    (updater: (current: AppNotification[]) => AppNotification[]) => {
      setNotifications((current) => {
        const updated = updater(current);
        pollStateRef.current = { ...pollStateRef.current, notifications: updated };
        if (baseUrl && userId) saveNotificationsState(baseUrl, userId, pollStateRef.current);
        return updated;
      });
    },
    [baseUrl, userId],
  );

  const markRead = useCallback(
    (id: string) => persistNotifications((current) => markNotificationRead(current, id)),
    [persistNotifications],
  );

  const markAllRead = useCallback(
    () => persistNotifications(markAllNotificationsRead),
    [persistNotifications],
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, markRead, markAllRead };
}
