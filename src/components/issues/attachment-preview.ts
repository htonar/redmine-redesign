export type AttachmentPreviewKind = "image" | "video" | "text" | "unsupported";

/**
 * content_type для текстовых форматов не всегда начинается с "text/" -
 * JSON/XML отдаются как application/* даже когда по сути это читаемый текст
 * (issue #16 явно просит превью для "текст", а не только для точного
 * text/plain).
 */
const TEXT_APPLICATION_TYPES = new Set([
  "application/json",
  "application/xml",
  "application/javascript",
  "application/x-yaml",
  "application/yaml",
]);

export function getPreviewKind(
  contentType: string | null | undefined,
): AttachmentPreviewKind {
  if (!contentType) return "unsupported";
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("text/") || TEXT_APPLICATION_TYPES.has(contentType)) {
    return "text";
  }
  return "unsupported";
}

/**
 * Верхняя граница размера файла, для которого делаем текстовый предпросмотр.
 * Проверяется по метаданным вложения (filesize) до какого-либо запроса тела -
 * не тянуть мегабайтные логи/дампы целиком только чтобы показать превью,
 * когда пользователю нужнее сразу скачать файл.
 */
const TEXT_PREVIEW_SIZE_LIMIT_BYTES = 1024 * 1024; // 1 МБ

export function isPreviewableTextSize(filesize: number): boolean {
  return filesize <= TEXT_PREVIEW_SIZE_LIMIT_BYTES;
}
