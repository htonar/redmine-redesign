import { describe, expect, it, vi } from "vitest";
import { listQueries } from "@/api/queries";
import type { RedmineClient } from "@/api/client";

function mockClient(GET: ReturnType<typeof vi.fn>): RedmineClient {
  return { GET } as unknown as RedmineClient;
}

describe("listQueries", () => {
  it("запрашивает /queries.{format} и маппит поля в camelCase", async () => {
    const GET = vi.fn().mockResolvedValue({
      data: {
        queries: [
          { id: 1, name: "Мои открытые", is_public: false, project_id: 42 },
          { id: 2, name: "Все задачи", is_public: true, project_id: null },
        ],
      },
    });

    const result = await listQueries(mockClient(GET));

    expect(GET).toHaveBeenCalledWith(
      "/queries.{format}",
      expect.objectContaining({
        params: expect.objectContaining({ path: { format: "json" } }),
      }),
    );
    expect(result).toEqual([
      { id: 1, name: "Мои открытые", isPublic: false, projectId: 42 },
      { id: 2, name: "Все задачи", isPublic: true, projectId: null },
    ]);
  });

  it("бросает ошибку, если API вернул error/пустые данные", async () => {
    const GET = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    await expect(listQueries(mockClient(GET))).rejects.toThrow(
      "Не удалось загрузить сохраненные запросы Redmine.",
    );
  });

  it("пустой список queries -> пустой результат, не ошибка", async () => {
    const GET = vi.fn().mockResolvedValue({ data: { queries: [] } });
    const result = await listQueries(mockClient(GET));
    expect(result).toEqual([]);
  });
});
