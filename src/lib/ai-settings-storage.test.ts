import { afterEach, describe, expect, it } from "vitest";
import {
  clearAiSettings,
  isAiConfigured,
  loadAiSettings,
  saveAiSettings,
  type AiSettingsStored,
} from "./ai-settings-storage";

afterEach(() => {
  localStorage.clear();
});

describe("ai-settings-storage", () => {
  it("loadAiSettings возвращает {} когда ничего не сохранено", () => {
    expect(loadAiSettings()).toEqual({});
  });

  it("saveAiSettings/loadAiSettings - round trip", () => {
    const settings: AiSettingsStored = {
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "key-123",
      model: "some/model",
    };

    saveAiSettings(settings);

    expect(loadAiSettings()).toEqual(settings);
  });

  it("clearAiSettings удаляет сохраненные настройки", () => {
    saveAiSettings({ baseUrl: "https://x", apiKey: "k", model: "m" });

    clearAiSettings();

    expect(loadAiSettings()).toEqual({});
  });

  it("поврежденный JSON в localStorage - считаем что настроек нет", () => {
    localStorage.setItem("redmine-client:ai-settings", "{not valid json");

    expect(loadAiSettings()).toEqual({});
  });

  it("игнорирует посторонние/неверного типа поля", () => {
    localStorage.setItem(
      "redmine-client:ai-settings",
      JSON.stringify({ baseUrl: "https://x", apiKey: 42, extra: "junk" }),
    );

    expect(loadAiSettings()).toEqual({ baseUrl: "https://x" });
  });
});

describe("isAiConfigured", () => {
  it("false для пустых настроек", () => {
    expect(isAiConfigured({})).toBe(false);
  });

  it("false когда не хватает хотя бы одного поля", () => {
    expect(isAiConfigured({ baseUrl: "https://x", apiKey: "k" })).toBe(false);
  });

  it("true когда все три поля заданы и непустые", () => {
    expect(isAiConfigured({ baseUrl: "https://x", apiKey: "k", model: "m" })).toBe(true);
  });

  it("false когда поле пустая строка", () => {
    expect(isAiConfigured({ baseUrl: "", apiKey: "k", model: "m" })).toBe(false);
  });
});
