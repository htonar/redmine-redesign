import { beforeEach, describe, expect, it } from "vitest";
import {
  loadNotificationsState,
  saveNotificationsState,
  mergeNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationsState,
} from "@/lib/notifications-storage";
import type { AppNotification } from "@/lib/notifications";

const BASE_URL = "https://redmine.example.com";
const USER_ID = 1;

function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "1-assigned-1000",
    issueId: 1,
    issueSubject: "Тестовая задача",
    trigger: "assigned",
    message: "Задача #1 «Тестовая задача» назначена на вас.",
    createdAt: "2026-08-14T10:00:00.000Z",
    read: false,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("loadNotificationsState", () => {
  it("возвращает пустое состояние, если в хранилище ничего нет", () => {
    expect(loadNotificationsState(BASE_URL, USER_ID)).toEqual({
      snapshots: {},
      notifiedDue: {},
      notifications: [],
      hasPolledBefore: false,
    });
  });

  it("возвращает пустое состояние на битом JSON, а не бросает исключение", () => {
    localStorage.setItem(
      `redmine-client:notifications:${BASE_URL}:${USER_ID}`,
      "{не json",
    );
    expect(loadNotificationsState(BASE_URL, USER_ID)).toEqual({
      snapshots: {},
      notifiedDue: {},
      notifications: [],
      hasPolledBefore: false,
    });
  });
});

describe("saveNotificationsState / loadNotificationsState", () => {
  it("сохраняет состояние и возвращает его же при следующей загрузке", () => {
    const state: NotificationsState = {
      snapshots: { 1: { statusId: 1, statusName: "Новая", isClosed: false, assignedToId: 1, dueDate: null, updatedOn: "2026-08-14T10:00:00Z" } },
      notifiedDue: { 1: "2026-08-16" },
      notifications: [makeNotification()],
      hasPolledBefore: true,
    };
    saveNotificationsState(BASE_URL, USER_ID, state);
    expect(loadNotificationsState(BASE_URL, USER_ID)).toEqual(state);
  });

  it("изолирует состояние по baseUrl и userId", () => {
    const state: NotificationsState = {
      snapshots: {},
      notifiedDue: {},
      notifications: [makeNotification()],
      hasPolledBefore: true,
    };
    saveNotificationsState(BASE_URL, USER_ID, state);

    expect(loadNotificationsState("https://other.example.com", USER_ID).hasPolledBefore).toBe(false);
    expect(loadNotificationsState(BASE_URL, 2).hasPolledBefore).toBe(false);
  });
});

describe("mergeNotifications", () => {
  it("новые уведомления кладутся в начало списка", () => {
    const existing = [makeNotification({ id: "old" })];
    const incoming = [makeNotification({ id: "new" })];
    expect(mergeNotifications(existing, incoming).map((n) => n.id)).toEqual(["new", "old"]);
  });

  it("капает список на 50 записей, отбрасывая самые старые", () => {
    const existing = Array.from({ length: 50 }, (_, i) => makeNotification({ id: `old-${i}` }));
    const incoming = [makeNotification({ id: "new" })];
    const result = mergeNotifications(existing, incoming);
    expect(result).toHaveLength(50);
    expect(result[0].id).toBe("new");
    expect(result.some((n) => n.id === "old-49")).toBe(false);
  });

  it("без новых уведомлений возвращает список как есть", () => {
    const existing = [makeNotification({ id: "a" })];
    expect(mergeNotifications(existing, [])).toEqual(existing);
  });
});

describe("markNotificationRead", () => {
  it("помечает только указанное уведомление прочитанным", () => {
    const notifications = [makeNotification({ id: "a" }), makeNotification({ id: "b" })];
    const result = markNotificationRead(notifications, "a");
    expect(result.find((n) => n.id === "a")?.read).toBe(true);
    expect(result.find((n) => n.id === "b")?.read).toBe(false);
  });
});

describe("markAllNotificationsRead", () => {
  it("помечает все уведомления прочитанными", () => {
    const notifications = [makeNotification({ id: "a" }), makeNotification({ id: "b" })];
    const result = markAllNotificationsRead(notifications);
    expect(result.every((n) => n.read)).toBe(true);
  });
});
