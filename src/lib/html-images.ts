/**
 * Иногда описание или комментарий приходит с сырым HTML-тегом картинки
 * вместо markdown: `<img style="width: 1920px;" src="clipboard-...png"><br>`
 * (так вставляет картинку из буфера часть конфигураций Redmine и
 * rich-text-редакторов). react-markdown без rehype-raw такой тег молча
 * выкидывает - картинка не показывается (issue #67).
 *
 * Разовый препроцесс: переписываем `<img>` в markdown
 * `![alt](src "width=… height=…")` - тем же контрактом, что
 * textileImagesToMarkdown: размер уезжает в title, дальше его разбирает
 * parseImageTitle. Резолв имени файла во вложение - как у обычного
 * `![](name)`. Не трогает исходный текст в редакторе, только то, что идёт
 * на рендер.
 *
 * Чистая функция, тестируется отдельно.
 */

const IMG_TAG_RE = /<img\b[^>]*>/gi;

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i"),
  );
  if (!m) return undefined;
  return (m[2] ?? m[3] ?? m[4] ?? "").trim() || undefined;
}

/** Имя файла без пути и query - для alt, когда его нет в самой разметке. */
function basename(src: string): string {
  const last = src.split(/[\\/]/).pop() ?? src;
  return last.split(/[?#]/)[0] || src;
}

/** Размер без единиц измерения считаем пикселями (HTML-атрибут width/height). */
function withUnit(value: string): string {
  return /^[0-9.]+$/.test(value.trim()) ? `${value.trim()}px` : value.trim();
}

function styleDimension(
  style: string,
  prop: "width" | "height",
): string | undefined {
  const m = style.match(
    new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([0-9.]+(?:px|%|em|rem)?)`, "i"),
  );
  return m ? m[1] : undefined;
}

function dimension(tag: string, prop: "width" | "height"): string | undefined {
  const fromAttr = attr(tag, prop);
  if (fromAttr) return withUnit(fromAttr);
  const style = attr(tag, "style");
  return style ? styleDimension(style, prop) : undefined;
}

export function htmlImagesToMarkdown(text: string): string {
  if (!text || !text.toLowerCase().includes("<img")) return text;

  return text.replace(IMG_TAG_RE, (tag) => {
    const src = attr(tag, "src");
    if (!src) return tag;

    const w = dimension(tag, "width");
    const h = dimension(tag, "height");
    const titleBits: string[] = [];
    if (w) titleBits.push(`width=${w}`);
    if (h) titleBits.push(`height=${h}`);
    const title = titleBits.length ? ` "${titleBits.join(" ")}"` : "";

    const label = attr(tag, "alt") || basename(src);
    return `![${label}](${src}${title})`;
  });
}
