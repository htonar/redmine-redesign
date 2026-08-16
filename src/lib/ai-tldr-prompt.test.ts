import { describe, expect, it } from "vitest";
import { buildTldrMessages, type TldrJournal } from "./ai-tldr-prompt";

function journal(overrides: Partial<TldrJournal>): TldrJournal {
  return {
    id: 1,
    notes: "",
    details: [],
    ...overrides,
  };
}

describe("buildTldrMessages", () => {
  it("system-сообщение требует ответ на русском", () => {
    const [system] = buildTldrMessages("описание", []);

    expect(system.role).toBe("system");
    expect(system.content).toMatch(/русск/i);
  });

  it("user-сообщение содержит описание задачи", () => {
    const [, user] = buildTldrMessages("важное описание задачи", []);

    expect(user.role).toBe("user");
    expect(user.content).toContain("важное описание задачи");
  });

  it("user-сообщение содержит текст всех journal-комментариев по порядку", () => {
    const journals: TldrJournal[] = [
      journal({ id: 1, notes: "первый комментарий" }),
      journal({ id: 2, notes: "второй комментарий" }),
    ];

    const [, user] = buildTldrMessages(undefined, journals);

    const first = user.content.indexOf("первый комментарий");
    const second = user.content.indexOf("второй комментарий");
    expect(first).toBeGreaterThanOrEqual(0);
    expect(second).toBeGreaterThan(first);
  });

  it("описывает изменения полей (details) человекочитаемо", () => {
    const journals: TldrJournal[] = [
      journal({
        id: 1,
        notes: "",
        details: [{ property: "attr", name: "status_id", old_value: "1", new_value: "2" }],
      }),
    ];

    const [, user] = buildTldrMessages(undefined, journals);

    expect(user.content).toContain("Статус");
  });

  it("пустая история и отсутствующее описание не ломают функцию", () => {
    const messages = buildTldrMessages(undefined, []);

    expect(messages).toHaveLength(2);
    expect(messages[1].content).toBeTruthy();
  });

  it("отсутствующее описание не добавляет мусор в текст", () => {
    const [, user] = buildTldrMessages(undefined, [journal({ id: 1, notes: "коммент" })]);

    expect(user.content).not.toMatch(/undefined|null/);
  });
});
