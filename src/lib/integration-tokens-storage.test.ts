import { beforeEach, describe, expect, it } from "vitest";
import {
  clearIntegrationTokens,
  loadIntegrationTokens,
  saveIntegrationTokens,
} from "./integration-tokens-storage";

describe("integration-tokens-storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("возвращает пустой объект, если в сторадже ничего нет", () => {
    expect(loadIntegrationTokens()).toEqual({});
  });

  it("сохраняет и загружает оба токена", () => {
    saveIntegrationTokens({ github: "ghp_123", gitlab: "glpat-456" });
    expect(loadIntegrationTokens()).toEqual({
      github: "ghp_123",
      gitlab: "glpat-456",
    });
  });

  it("позволяет сохранить только один из токенов", () => {
    saveIntegrationTokens({ github: "ghp_123" });
    expect(loadIntegrationTokens()).toEqual({ github: "ghp_123" });
  });

  it("clearIntegrationTokens убирает сохранённые токены", () => {
    saveIntegrationTokens({ github: "ghp_123", gitlab: "glpat-456" });
    clearIntegrationTokens();
    expect(loadIntegrationTokens()).toEqual({});
  });

  it("игнорирует повреждённые данные в сторадже", () => {
    localStorage.setItem("redmine-client:integration-tokens", "не json");
    expect(loadIntegrationTokens()).toEqual({});
  });
});
