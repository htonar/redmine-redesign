import { isTauri } from "@tauri-apps/api/core";

/**
 * В десктоп-сборке (WebKitGTK-webview под Tauri) вставка картинки из
 * системного буфера не приходит в `ClipboardEvent` - `clipboardData.items`
 * пустой, в отличие от обычного браузера (issue #67, комментарий про
 * десктоп). Читаем картинку напрямую через tauri-plugin-clipboard-manager и
 * отдаём `File`, чтобы дальше её обрабатывал тот же путь, что и вставку в
 * вебе (MarkdownEditor.handleFiles).
 *
 * Возвращает `null`, если это не десктоп-сборка или в буфере нет картинки
 * (обычная вставка текста) - вызывающий тогда не вмешивается в дефолтное
 * поведение.
 */
export async function readTauriClipboardImage(): Promise<File | null> {
  if (!isTauri()) return null;

  let rgba: Uint8Array;
  let size: { width: number; height: number };
  try {
    const { readImage } = await import(
      "@tauri-apps/plugin-clipboard-manager"
    );
    const image = await readImage();
    rgba = await image.rgba();
    size = await image.size();
  } catch {
    // В буфере не картинка (или плагин недоступен) - это не ошибка сценария.
    return null;
  }

  const { width, height } = size;
  if (!width || !height || rgba.length < width * height * 4) return null;

  const blob = await rgbaToPngBlob(rgba, width, height);
  if (!blob) return null;

  // Имя "image.png" - handleFiles сам заменит его на уникальное
  // (uniquePasteName), как для вставки из браузера.
  return new File([blob], "image.png", { type: "image/png" });
}

async function rgbaToPngBlob(
  rgba: Uint8Array,
  width: number,
  height: number,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const data = new Uint8ClampedArray(rgba.slice(0, width * height * 4));
  ctx.putImageData(new ImageData(data, width, height), 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
