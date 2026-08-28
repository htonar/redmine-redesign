/**
 * Транслитерация кириллицы в латиницу для генерации имён веток (issue #27).
 * Таблица - практичный вариант, близкий к ГОСТ 7.79 система Б / популярной
 * веб-транслитерации: читаемо, без диакритики, только ASCII на выходе.
 *
 * Чистая функция без внешних зависимостей - тестируется отдельно.
 */

const MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
  // украинские/белорусские - не мешают, дешево поддержать
  і: "i", ї: "yi", є: "ye", ґ: "g", ў: "w",
};

export function transliterate(text: string): string {
  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    const mapped = MAP[lower];
    if (mapped === undefined) {
      out += ch;
      continue;
    }
    // Сохраняем регистр: если исходный символ был в верхнем регистре и
    // замена непустая - капитализируем первую букву замены.
    if (ch !== lower && mapped.length > 0) {
      out += mapped[0].toUpperCase() + mapped.slice(1);
    } else {
      out += mapped;
    }
  }
  return out;
}
