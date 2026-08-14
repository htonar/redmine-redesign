import { downloadBlob } from "@/lib/blob-download";

/**
 * Минимальный срез File System Access API, которого хватает для "Сохранить
 * как" (issue #16). Не в стандартном lib.dom.d.ts на момент написания -
 * описываем сами вместо завязки на конкретную версию @types/*.
 */
interface SaveFilePickerOptions {
  suggestedName?: string;
}
interface FileSystemWritableFileStream {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}
interface FileSystemFileHandleLike {
  createWritable(): Promise<FileSystemWritableFileStream>;
}
type ShowSaveFilePicker = (
  options?: SaveFilePickerOptions,
) => Promise<FileSystemFileHandleLike>;

/**
 * "Сохранить как" с выбором места на диске. File System Access API
 * (`showSaveFilePicker`) поддержан в Chromium-based браузерах и в Tauri
 * (webview на Windows/Linux использует тот же движок) - дает пользователю
 * настоящий системный диалог сохранения вместо тихого падения в дефолтную
 * папку загрузок. Там, где API нет (Firefox, Safari) - тихий fallback на
 * обычное скачивание (downloadBlob), без выбора места, но без ошибки в UI.
 *
 * AbortError (пользователь закрыл диалог кнопкой "Отмена") - это штатный
 * исход, не ошибка приложения, поэтому проглатывается молча; любая другая
 * ошибка (например реальный сбой записи) пробрасывается вызывающему коду.
 */
export async function saveBlobAs(blob: Blob, suggestedName: string): Promise<void> {
  const picker = (window as unknown as { showSaveFilePicker?: ShowSaveFilePicker })
    .showSaveFilePicker;

  if (typeof picker !== "function") {
    downloadBlob(blob, suggestedName);
    return;
  }

  try {
    const handle = await picker({ suggestedName });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    throw err;
  }
}
