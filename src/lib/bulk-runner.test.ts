import { describe, expect, it, vi } from "vitest";
import { runBulk, summarizeBulk } from "@/lib/bulk-runner";

describe("runBulk", () => {
  it("все успешно - ok заполнен, failed пуст", async () => {
    const r = await runBulk([1, 2, 3], async () => {}, { concurrency: 2 });
    expect(r.ok).toEqual([1, 2, 3]);
    expect(r.failed).toEqual([]);
  });

  it("часть падает - разносит по ok/failed", async () => {
    const r = await runBulk([1, 2, 3, 4], async (id) => {
      if (id % 2 === 0) throw new Error(`bad ${id}`);
    });
    expect(r.ok).toEqual([1, 3]);
    expect(r.failed).toEqual([
      { id: 2, error: "bad 2" },
      { id: 4, error: "bad 4" },
    ]);
  });

  it("onProgress вызывается на каждую операцию", async () => {
    const onProgress = vi.fn();
    await runBulk([1, 2, 3], async () => {}, { concurrency: 1, onProgress });
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenLastCalledWith(3, 3);
  });

  it("не запускает больше concurrency одновременно", async () => {
    let active = 0;
    let maxActive = 0;
    await runBulk(
      [1, 2, 3, 4, 5, 6],
      async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 5));
        active -= 1;
      },
      { concurrency: 2 },
    );
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("пустой список - пустой результат, task не зовётся", async () => {
    const task = vi.fn();
    const r = await runBulk([], task);
    expect(r).toEqual({ ok: [], failed: [] });
    expect(task).not.toHaveBeenCalled();
  });
});

describe("summarizeBulk", () => {
  it("всё ок", () => {
    expect(summarizeBulk({ ok: [1, 2], failed: [] })).toBe(
      "Готово: обновлено 2.",
    );
  });
  it("всё упало", () => {
    expect(
      summarizeBulk({ ok: [], failed: [{ id: 1, error: "x" }] }),
    ).toMatch(/ни одну/);
  });
  it("частично", () => {
    expect(
      summarizeBulk({ ok: [1], failed: [{ id: 2, error: "x" }] }),
    ).toBe("Обновлено 1, с ошибкой 1: #2");
  });
});
