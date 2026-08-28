import { invoke, isTauri } from "@tauri-apps/api/core";

/**
 * System tray (issue #5, только десктоп-сборка) - переключает иконку трея
 * между обычной и с точкой-индикатором непрочитанных уведомлений и обновляет
 * tooltip со счётчиком. В веб-сборке не делает ничего - как
 * sendOsNotification в os-notifications.ts, isTauri() гейтит всё
 * десктоп-специфичное.
 */
export async function syncTrayBadge(unreadCount: number): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("set_tray_unread", { unreadCount });
  } catch {
    // Бейдж на иконке трея - дополнение к in-app бейджу (NotificationsBell),
    // не основной канал. Сбой здесь не должен ронять остальную логику.
  }
}
