/**
 * Redmine-инстансы с форматом текста Textile (старый дефолт Redmine) вставляют
 * картинки не markdown-синтаксисом `![](name)`, а Textile: `!name!`,
 * `!name(alt)!`, `!{width: 680px}.name!`, `!name!:link`. Вставка картинки из
 * буфера в таком инстансе даёт, например,
 * `!{width: 680px}.clipboard-202608261432-v8hhf.png!`.
 *
 * Мы рендерим текст как markdown (react-markdown), поэтому такие вставки
 * пролетают сырым текстом. Здесь - разовый препроцесс: переписываем Textile-
 * картинки в markdown `![alt](src "width=… height=…")`. Размер уезжает в
 * title картинки, MarkdownContent разбирает его обратно (parseImageTitle) и
 * вешает стилем. Резолв имени во вложение - как у обычного `![](name)`.
 *
 * Чистая функция, тестируется отдельно. Не трогает исходный текст в
 * редакторе - только то, что идёт на рендер.
 */

/** Только то, что похоже на медиафайл или URL - иначе `!текст!` в описании ложно сматчился бы. */
const MEDIA_EXT =
  /\.(png|jpe?g|gif|webp|svg|bmp|avif|mp4|webm|mov|m4v|mkv|mp3|ogg|oga|wav|flac|m4a)$/i;

/**
 * `!` + [выравнивание] + [{style}/(class)/[lang] блоки] + [`.`] + src +
 * [`(alt)`] + `!` + [`:link`].
 */
const TEXTILE_IMAGE_RE =
  /!([<>=]{1,2})?((?:\{[^}]*\}|\([^)]*\)|\[[^\]]*\])*)\.?\s?([^\s!()<>]+)(?:\(([^)]*)\))?!(?::(\S+))?/g;

/** Имя файла без пути и query - для alt, когда его нет в самой разметке. */
function basename(src: string): string {
  const last = src.split(/[\\/]/).pop() ?? src;
  return last.split(/[?#]/)[0] || src;
}

function dimension(
  styleBlocks: string,
  prop: "width" | "height",
): string | undefined {
  const m = styleBlocks.match(
    new RegExp(`${prop}\\s*:\\s*([0-9.]+(?:px|%|em|rem)?)`, "i"),
  );
  return m ? m[1] : undefined;
}

export function textileImagesToMarkdown(text: string): string {
  if (!text || !text.includes("!")) return text;

  return text.replace(
    TEXTILE_IMAGE_RE,
    (full, _align, styleBlocks: string, src: string, alt: string, link: string) => {
      const isUrl = /^https?:\/\//i.test(src);
      if (!isUrl && !MEDIA_EXT.test(src)) return full;

      const blocks = styleBlocks || "";
      const w = dimension(blocks, "width");
      const h = dimension(blocks, "height");
      const titleBits: string[] = [];
      if (w) titleBits.push(`width=${w}`);
      if (h) titleBits.push(`height=${h}`);
      const title = titleBits.length ? ` "${titleBits.join(" ")}"` : "";

      const label = alt?.trim() || basename(src);
      const img = `![${label}](${src}${title})`;
      return link ? `[${img}](${link})` : img;
    },
  );
}

/**
 * Разбирает title картинки, который мы кладём при конверсии Textile:
 * `"width=680px height=383px"`. Если это не пара размеров - считаем title
 * обычным (возвращаем как есть).
 */
export function parseImageTitle(title: string | null | undefined): {
  width?: string;
  height?: string;
  title?: string;
} {
  if (!title) return {};
  const w = title.match(/width=([0-9.]+(?:px|%|em|rem)?)/i);
  const h = title.match(/height=([0-9.]+(?:px|%|em|rem)?)/i);
  if (!w && !h) return { title };
  return { width: w?.[1], height: h?.[1] };
}
