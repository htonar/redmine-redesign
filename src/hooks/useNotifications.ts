import { useCallback, useEffect, useRef, useState } from "react";
import type { RedmineClient } from "@/api/client";
import { listIssues } from "@/api/issues";
import {
  diffIssuesForNotifications,
  filterNotificationsByTriggers,
  NOTIFICATION_TRIGGER_LABELS,
  type AppNotification,
  type NotificationSettings,
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

/** За сколько дней до дедлайна начинаем напоминать. */
const DUE_SOON_DAYS = 3;
/** Срез задач за один опрос (assigned и watched запрашиваются отдельно). */
const ISSUES_PER_QUERY_LIMIT = 100;

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
 * Настройки (вкл/выкл, триггеры, интервал, OS push) - issue #4, персистятся
 * через usePersistedState на уровне вызывающего кода (AppLayout.tsx) и
 * передаются сюда параметром - сам хук по-прежнему только оркестрация.
 */
export function useNotifications(
  client: RedmineClient | null,
  baseUrl: string | null,
  userId: number | undefined,
  settings: NotificationSettings,
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

    // Общий выключатель (issue #4) - не полирует Redmine вообще, но уже
    // накопленные уведомления остаются видны в бейдже.
    if (!settings.enabled) return;

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
        // Снэпшоты/notifiedDue сохраняем от диффа целиком (не отфильтрованные)
        // - выключенный триггер не должен ломать сравнение на следующем
        // опросе, если пользователь снова включит его.
        const shownNotifications = filterNotificationsByTriggers(
          diff.notifications,
          settings.triggers,
        );

        const nextState: NotificationsState = {
          snapshots: diff.snapshots,
          notifiedDue: diff.notifiedDue,
          notifications: mergeNotifications(prev.notifications, shownNotifications),
          hasPolledBefore: true,
        };
        pollStateRef.current = nextState;
        setNotifications(nextState.notifications);
        saveNotificationsState(activeBaseUrl, activeUserId, nextState);

        if (settings.osPushEnabled) {
          for (const notification of shownNotifications) {
            void sendOsNotification(
              NOTIFICATION_TRIGGER_LABELS[notification.trigger],
              notification.message,
            );
          }
        }
      } catch {
        // Один неудачный опрос (сеть, 403 и т.п.) не должен ронять таймер -
        // повторим на следующем тике.
      }
    }

    void poll();
    const interval = setInterval(
      () => void poll(),
      settings.intervalMinutes * 60 * 1000,
    );

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [client, baseUrl, userId, settings]);

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
