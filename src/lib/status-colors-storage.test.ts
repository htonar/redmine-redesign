import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadStatusColors,
  saveStatusColors,
} from "@/lib/status-colors-storage";

const BASE = "https://redmine.test";
const USER = 7;

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("status-colors-storage", () => {
  it("сохраняет и читает карту по baseUrl+user", () => {
    saveStatusColors(BASE, USER, { "заморожен": "info" });
    expect(loadStatusColors(BASE, USER)).toEqual({ "заморожен": "info" });
  });

  it("без baseUrl/user - no-op и пустая карта", () => {
    saveStatusColors(null, USER, { "заморожен": "info" });
    expect(loadStatusColors(null, USER)).toEqual({});
    expect(loadStatusColors(BASE, undefined)).toEqual({});
  });

  it("чужая запись другого пользователя не видна", () => {
    saveStatusColors(BASE, USER, { "заморожен": "info" });
    expect(loadStatusColors(BASE, 99)).toEqual({});
  });

  it("битый JSON в сторадже - пустая карта", () => {
    localStorage.setItem(
      `redmine-client:status-colors:${BASE}:${USER}`,
      "{not json",
    );
    expect(loadStatusColors(BASE, USER)).toEqual({});
  });

  it("нормализует ключи и отбрасывает невалидные значения при чтении", () => {
    localStorage.setItem(
      `redmine-client:status-colors:${BASE}:${USER}`,
      JSON.stringify({ " Заморожен ": "info", bad: "rainbow" }),
    );
    expect(loadStatusColors(BASE, USER)).toEqual({ "заморожен": "info" });
  });
});
