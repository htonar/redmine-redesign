/**
 * Скачивание blob в дефолтную папку загрузок браузера - без выбора места
 * (см. saveBlobAs в save-file.ts для варианта с выбором). Общий кусок,
 * которым пользуются и быстрое скачивание вложений (api/attachments.ts), и
 * fallback для "Сохранить как" там, где File System Access API недоступен.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
