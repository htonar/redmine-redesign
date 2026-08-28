/**
 * Пакетный прогон операции над списком id с ограниченной параллельностью
 * (issue #37) - в Redmine REST нет bulk-эндпоинта, поэтому шлём N запросов и
 * собираем сводку ошибок. Чистая функция: сама сеть - в переданном `task`.
 */

export interface BulkFailure {
  id: number;
  error: string;
}

export interface BulkResult {
  ok: number[];
  failed: BulkFailure[];
}

export interface RunBulkOptions {
  /** Сколько операций одновременно. По умолчанию 5. */
  concurrency?: number;
  /** Вызывается после каждой завершённой операции (для прогресс-бара). */
  onProgress?: (done: number, total: number) => void;
}

export async function runBulk(
  ids: number[],
  task: (id: number) => Promise<void>,
  options: RunBulkOptions = {},
): Promise<BulkResult> {
  const concurrency = Math.max(1, options.concurrency ?? 5);
  const result: BulkResult = { ok: [], failed: [] };
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        await task(id);
        result.ok.push(id);
      } catch (e) {
        result.failed.push({
          id,
          error: e instanceof Error ? e.message : "Неизвестная ошибка",
        });
      } finally {
        done += 1;
        options.onProgress?.(done, ids.length);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, ids.length) }, () => worker()),
  );

  // Порядок ok/failed не гарантирован из-за параллельности - сортируем для
  // стабильного вывода.
  result.ok.sort((a, b) => a - b);
  result.failed.sort((a, b) => a.id - b.id);
  return result;
}

/** Короткая человекочитаемая сводка результата. */
export function summarizeBulk(result: BulkResult): string {
  if (result.failed.length === 0) {
    return `Готово: обновлено ${result.ok.length}.`;
  }
  if (result.ok.length === 0) {
    return `Не удалось обновить ни одну из ${result.failed.length} задач.`;
  }
  return `Обновлено ${result.ok.length}, с ошибкой ${result.failed.length}: ${result.failed
    .map((f) => `#${f.id}`)
    .join(", ")}`;
}
