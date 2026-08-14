import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteIssueView,
  loadIssueViews,
  saveIssueView,
  type IssueView,
} from "@/lib/issue-views-storage";

const BASE_URL = "https://redmine.example.com";
const USER_ID = 1;

const view: IssueView = {
  id: "v1",
  name: "Мои открытые",
  filters: { assignee: "me", status: "open", sort: "updated_on:desc" },
};

beforeEach(() => {
  localStorage.clear();
});

describe("loadIssueViews", () => {
  it("возвращает пустой массив, если в хранилище ничего нет", () => {
    expect(loadIssueViews(BASE_URL, USER_ID)).toEqual([]);
  });

  it("возвращает пустой массив на битом JSON, а не бросает исключение", () => {
    localStorage.setItem(
      `redmine-client:issue-views:${BASE_URL}:${USER_ID}`,
      "{не json",
    );
    expect(loadIssueViews(BASE_URL, USER_ID)).toEqual([]);
  });

  it("возвращает пустой массив, если в хранилище лежит не массив", () => {
    localStorage.setItem(
      `redmine-client:issue-views:${BASE_URL}:${USER_ID}`,
      JSON.stringify({ not: "an array" }),
    );
    expect(loadIssueViews(BASE_URL, USER_ID)).toEqual([]);
  });
});

describe("saveIssueView / loadIssueViews", () => {
  it("сохраняет вид и возвращает его же при следующей загрузке", () => {
    saveIssueView(BASE_URL, USER_ID, view);
    expect(loadIssueViews(BASE_URL, USER_ID)).toEqual([view]);
  });

  it("накапливает несколько видов, не перетирая предыдущие", () => {
    const second: IssueView = { ...view, id: "v2", name: "Все закрытые" };
    saveIssueView(BASE_URL, USER_ID, view);
    saveIssueView(BASE_URL, USER_ID, second);
    expect(loadIssueViews(BASE_URL, USER_ID)).toEqual([view, second]);
  });

  it("изолирует виды по baseUrl - разные инстансы не пересекаются", () => {
    saveIssueView(BASE_URL, USER_ID, view);
    expect(loadIssueViews("https://other.example.com", USER_ID)).toEqual([]);
  });

  it("изолирует виды по userId - разные аккаунты на одном инстансе не пересекаются", () => {
    saveIssueView(BASE_URL, USER_ID, view);
    expect(loadIssueViews(BASE_URL, 2)).toEqual([]);
  });
});

describe("deleteIssueView", () => {
  it("убирает только запись с указанным id, остальные остаются", () => {
    const second: IssueView = { ...view, id: "v2", name: "Все закрытые" };
    saveIssueView(BASE_URL, USER_ID, view);
    saveIssueView(BASE_URL, USER_ID, second);

    deleteIssueView(BASE_URL, USER_ID, "v1");

    expect(loadIssueViews(BASE_URL, USER_ID)).toEqual([second]);
  });

  it("не падает при удалении несуществующего id", () => {
    saveIssueView(BASE_URL, USER_ID, view);
    expect(() => deleteIssueView(BASE_URL, USER_ID, "unknown")).not.toThrow();
    expect(loadIssueViews(BASE_URL, USER_ID)).toEqual([view]);
  });
});
