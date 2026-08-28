import { describe, expect, it } from "vitest";
import { transliterate } from "@/lib/transliterate";

describe("transliterate", () => {
  it("транслитерирует строчную кириллицу", () => {
    expect(transliterate("привет мир")).toBe("privet mir");
  });

  it("сохраняет регистр первой буквы для многосимвольных замен", () => {
    expect(transliterate("Щука")).toBe("Schuka");
    expect(transliterate("Йогурт")).toBe("Yogurt");
  });

  it("выкидывает ъ и ь", () => {
    expect(transliterate("подъезд")).toBe("podezd");
    expect(transliterate("день")).toBe("den");
  });

  it("не трогает латиницу, цифры и знаки", () => {
    expect(transliterate("fix bug #42 v2")).toBe("fix bug #42 v2");
  });

  it("смешанный текст", () => {
    expect(transliterate("Добавить OAuth-логин")).toBe("Dobavit OAuth-login");
  });
});
