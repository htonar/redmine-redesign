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
    sendNotification({ title, body });
  } catch {
    // OS push - дополнение к in-app бейджу, не основной канал. Сбой здесь
    // (например, платформа не поддерживает уведомления) не должен ронять
    // остальную логику поллинга.
  }
}
