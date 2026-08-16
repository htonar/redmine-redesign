import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

/**
 * Открытие внешней ссылки ("Открыть в Redmine" - IssueDetailPage.tsx,
 * IssuesPage.tsx) - issue #24. Обычный `<a target="_blank">` в вебе
 * открывает новую вкладку, но в Tauri webview никуда не ведет - там нет
 * системного браузера без отдельного плагина (`tauri-plugin-opener`,
 * src-tauri/src/lib.rs). В вебе поведение не меняется - тот же
 * `window.open`, что делал бы обычный клик по `<a target="_blank">`.
 */
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noreferrer");
}
