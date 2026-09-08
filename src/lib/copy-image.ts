/**
 * Скопировать картинку в буфер обмена как настоящее изображение, а не как
 * строку `blob:` object-URL. В webview (Tauri) правый клик по картинке из
 * вложения копировал бесполезный `blob:tauri://localhost/<uuid>` - вставить
 * такую "картинку" куда-либо нельзя (issue #67).
 *
 * Пишем ClipboardItem с байтами картинки. `navigator.clipboard.write` по
 * спецификации гарантированно принимает только `image/png`, поэтому не-PNG
 * (jpeg/webp/…) прогоняем через canvas в PNG. Анимация GIF и вектор SVG при
 * этом теряются - для "вставить картинкой" это ожидаемо.
 */
export async function copyImageToClipboard(blob: Blob): Promise<void> {
  if (
    typeof navigator === "undefined" ||
    !navigator.clipboard ||
    typeof ClipboardItem === "undefined"
  ) {
    throw new Error("Буфер обмена недоступен");
  }
  const png = blob.type === "image/png" ? blob : await encodePng(blob);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

async function encodePng(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context недоступен");
    ctx.drawImage(bitmap, 0, 0);
    const png = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!png) throw new Error("не удалось перекодировать картинку в PNG");
    return png;
  } finally {
    bitmap.close();
  }
}
