import { describe, expect, it } from "vitest";
import { resolveJournalFieldValue } from "./journal-format";

describe("resolveJournalFieldValue", () => {
  const maps = {
    status_id: { 1: "Новая", 4: "Решена" },
    priority_id: { 2: "Обычный" },
  };

  it("резолвит id в имя через карту для соответствующего поля", () => {
    expect(resolveJournalFieldValue("status_id", "1", maps)).toBe("Новая");
    expect(resolveJournalFieldValue("status_id", "4", maps)).toBe("Решена");
  });

  it("возвращает сырое значение, если карты для поля нет", () => {
    // parent_id ссылается на другую задачу - у нас нет карты id -> тема,
    // подгружать её ради истории не оправдано (N+1), остается номер задачи.
    expect(resolveJournalFieldValue("parent_id", "2", maps)).toBe("2");
  });

  it("возвращает сырое значение, если карта есть, но id в ней не найден", () => {
    // на случай, если статус/версия и т.п. с тех пор удалены - показываем
    // хотя бы то, что было в API, а не пустоту.
    expect(resolveJournalFieldValue("status_id", "99", maps)).toBe("99");
  });

  it("возвращает '—' для null-значения независимо от наличия карты", () => {
    expect(resolveJournalFieldValue("status_id", null, maps)).toBe("—");
  });

  it("не резолвит нечисловые/текстовые поля (даже если бы для них была карта)", () => {
    expect(resolveJournalFieldValue("subject", "Новый текст", maps)).toBe(
      "Новый текст",
    );
  });
});
