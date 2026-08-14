import { beforeEach, describe, expect, it } from "vitest";
import { loadPersistedState, savePersistedState } from "@/lib/persisted-state-storage";

const BASE_URL = "https://redmine.example.com";
const USER_ID = 1;

beforeEach(() => {
  localStorage.clear();
});

describe("loadPersistedState", () => {
  it("возвращает fallback, если в хранилище ничего нет", () => {
    expect(
      loadPersistedState(BASE_URL, USER_ID, "selected-project", null),
    ).toBeNull();
  });

  it("возвращает fallback на битом JSON, а не бросает исключение", () => {
    localStorage.setItem(
      `redmine-client:state:selected-project:${BASE_URL}:${USER_ID}`,
      "{не json",
    );
    expect(
      loadPersistedState(BASE_URL, USER_ID, "selected-project", null),
    ).toBeNull();
  });
});

describe("savePersistedState / loadPersistedState", () => {
  it("сохраняет значение и возвращает его же при следующей загрузке", () => {
    savePersistedState(BASE_URL, USER_ID, "selected-project", 42);
    expect(loadPersistedState(BASE_URL, USER_ID, "selected-project", null)).toBe(42);
  });

  it("сохраняет объект и возвращает эквивалентный при следующей загрузке", () => {
    const filters = { assignee: "me", status: "open", sort: "updated_on:desc", queryId: null };
    savePersistedState(BASE_URL, USER_ID, "issues-filters", filters);
    expect(loadPersistedState(BASE_URL, USER_ID, "issues-filters", null)).toEqual(filters);
  });

  it("не пересекает разные ключи между собой", () => {
    savePersistedState(BASE_URL, USER_ID, "selected-project", 1);
    savePersistedState(BASE_URL, USER_ID, "time-range", "w");
    expect(loadPersistedState(BASE_URL, USER_ID, "selected-project", null)).toBe(1);
    expect(loadPersistedState(BASE_URL, USER_ID, "time-range", null)).toBe("w");
  });

  it("изолирует значения по baseUrl - разные инстансы не пересекаются", () => {
    savePersistedState(BASE_URL, USER_ID, "selected-project", 42);
    expect(
      loadPersistedState("https://other.example.com", USER_ID, "selected-project", null),
    ).toBeNull();
  });

  it("изолирует значения по userId - разные аккаунты на одном инстансе не пересекаются", () => {
    savePersistedState(BASE_URL, USER_ID, "selected-project", 42);
    expect(loadPersistedState(BASE_URL, 2, "selected-project", null)).toBeNull();
  });

  it("перезаписывает предыдущее значение по тому же ключу", () => {
    savePersistedState(BASE_URL, USER_ID, "time-range", "w");
    savePersistedState(BASE_URL, USER_ID, "time-range", "m");
    expect(loadPersistedState(BASE_URL, USER_ID, "time-range", null)).toBe("m");
  });

  it("персистит выбранный вид списка задач (issue #17)", () => {
    savePersistedState(BASE_URL, USER_ID, "issues-layout", "kanban");
    expect(loadPersistedState(BASE_URL, USER_ID, "issues-layout", "table")).toBe(
      "kanban",
    );
  });

  it("персистит настройки уведомлений (issue #4)", () => {
    const settings = {
      enabled: false,
      triggers: { assigned: true, status_changed: false, activity: true, due_soon: false },
      intervalMinutes: 15,
      osPushEnabled: false,
    };
    savePersistedState(BASE_URL, USER_ID, "notification-settings", settings);
    expect(
      loadPersistedState(BASE_URL, USER_ID, "notification-settings", null),
    ).toEqual(settings);
  });
});
