import { describe, expect, it } from "vitest";
import { avatarColorClass, initialsFromName } from "@/lib/user-display";

describe("initialsFromName", () => {
  it("два слова -> первые буквы", () => {
    expect(initialsFromName("Иван Петров")).toBe("ИП");
    expect(initialsFromName("Redmine Admin")).toBe("RA");
  });
  it("три+ слова -> первое и последнее", () => {
    expect(initialsFromName("Анна Мария Иванова")).toBe("АИ");
  });
  it("убирает скобочную часть вроде (я)", () => {
    expect(initialsFromName("Redmine Admin (я)")).toBe("RA");
  });
  it("одно слово -> первая буква", () => {
    expect(initialsFromName("admin")).toBe("A");
  });
  it("пусто -> ?", () => {
    expect(initialsFromName("   ")).toBe("?");
  });
});

describe("avatarColorClass", () => {
  it("детерминирован для одного имени", () => {
    expect(avatarColorClass("Иван Петров")).toBe(avatarColorClass("Иван Петров"));
  });
  it("разные имена обычно дают разные классы", () => {
    const a = avatarColorClass("Иван Петров");
    const b = avatarColorClass("Пётр Сидоров");
    expect(typeof a).toBe("string");
    expect(a).not.toBe(b);
  });
});
