import { isTauri } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

/**
 * OS-level push для десктоп-сборки (issue #3, Tauri notification API) - в
 * веб-сборке (Vite dev/prod, Docker) не делает ничего, есть только in-app
 * бейдж (NotificationsBell). Permission спрашиваем лениво при первой
 * отправке, не при старте приложения - незачем дёргать системный диалог
 * раньше, чем реально появится что показать (по образцу useAppUpdater.ts,
 * где isTauri() тоже гейтит всё десктоп-специфичное).
 */

/**
 * На Linux (Cinnamon/GNOME) уведомление без иконки часто получает только
 * звук, но не показывается визуально (issue #25) - передаём имя иконки
 * установленного приложения. Для .deb/.rpm-сборки Tauri ставит иконку в
 * hicolor-тему под именем productName в нижнем регистре ("redfine"). На
 * Windows/macOS icon по имени темы неприменим - не передаём.
 */
const LINUX_NOTIFICATION_ICON =
  typeof navigator !== "undefined" && /Linux/.test(navigator.userAgent)
    ? "redfine"
    : undefined;

let permissionPromise: Promise<boolean> | null = null;

async function ensurePermission(): Promise<boolean> {
  if (!permissionPromise) {
    permissionPromise = (async () => {
      if (await isPermissionGranted()) return true;
      const permission = await requestPermission();
      return permission === "granted";
    })();
  }
  return permissionPromise;
}

export async function sendOsNotification(title: string, body: string): Promise<void> {
  if (!isTauri()) return;
  try {
    const granted = await ensurePermission();
    if (!granted) return;
    sendNotification({ title, body, icon: LINUX_NOTIFICATION_ICON });
  } catch {
    // OS push - дополнение к in-app бейджу, не основной канал. Сбой здесь
    // (например, платформа не поддерживает уведомления) не должен ронять
    // остальную логику поллинга.
  }
}
