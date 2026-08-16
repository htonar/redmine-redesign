/**
 * Сериализация в CSV (RFC 4180) - общий хелпер для экспортов отчётов и
 * учёта времени (issue #21). Чистые функции без похода за данными и без
 * скачивания файла - за это отвечает src/lib/save-file.ts.
 */

/** Оборачивает значение в кавычки, если оно содержит `,`, `"` или перевод строки. */
export function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Собирает CSV-строку из заголовка и строк. Разделитель ячеек - `,`, строк -
 * `\r\n` (совместимость с Excel). Без UTF-8 BOM - его добавляет вызывающий
 * код при сборке Blob (см. CSV_BOM), чтобы юнит-тесты сравнивали строки
 * напрямую без мусора в начале.
 */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(escapeCsvCell), ...rows.map((row) => row.map((cell) => escapeCsvCell(String(cell))))];
  return lines.map((line) => line.join(",")).join("\r\n");
}

/** UTF-8 BOM - без него Excel показывает кириллицу кракозябрами. */
export const CSV_BOM = "﻿";
