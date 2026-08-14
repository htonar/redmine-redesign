import { describe, expect, it } from "vitest";
import {
  diffIssuesForNotifications,
  type DiffIssuesInput,
  type IssueSnapshot,
} from "@/lib/notifications";
import type { IssueSummary } from "@/api/issues";

const ME = 1;
const OTHER = 2;
const NOW = new Date("2026-08-14T12:00:00.000Z");

function issue(overrides: Partial<{
  id: number;
  subject: string;
  statusId: number;
  statusName: string;
  isClosed: boolean;
  assignedToId: number | null;
  dueDate: string | null;
  updatedOn: string;
}> = {}): IssueSummary {
  const {
    id = 1,
    subject = "Тестовая задача",
    statusId = 1,
    statusName = "Новая",
    isClosed = false,
    assignedToId = ME,
    dueDate = null,
    updatedOn = "2026-08-14T10:00:00Z",
  } = overrides;

  return {
    id,
    subject,
    status: { id: statusId, name: statusName, is_closed: isClosed },
    assigned_to: assignedToId === null ? undefined : { id: assignedToId, name: "Кто-то" },
    due_date: dueDate,
    updated_on: updatedOn,
  } as unknown as IssueSummary;
}

function baseInput(overrides: Partial<DiffIssuesInput> = {}): DiffIssuesInput {
  return {
    previousSnapshots: {},
    notifiedDue: {},
    assignedIssues: [],
    watchedIssues: [],
    currentUserId: ME,
    dueSoonDays: 3,
    isFirstPoll: false,
    now: NOW,
    ...overrides,
  };
}

describe("diffIssuesForNotifications", () => {
  it("первый опрос молчит и только сидирует снэпшоты", () => {
    const result = diffIssuesForNotifications(
      baseInput({
        isFirstPoll: true,
        assignedIssues: [issue({ id: 1 })],
      }),
    );

    expect(result.notifications).toEqual([]);
    expect(result.snapshots[1]).toBeDefined();
    expect(result.notifiedDue).toEqual({});
  });

  it("новая задача в assigned-списке (не было в снэпшоте) -> assigned", () => {
    const result = diffIssuesForNotifications(
      baseInput({
        assignedIssues: [issue({ id: 1, assignedToId: ME })],
      }),
    );

    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]).toMatchObject({ issueId: 1, trigger: "assigned" });
  });

  it("задачу переназначили с другого человека на меня -> assigned", () => {
    const prev: Record<number, IssueSnapshot> = {
      1: {
        statusId: 1,
        statusName: "Новая",
        isClosed: false,
        assignedToId: OTHER,
        dueDate: null,
        updatedOn: "2026-08-13T00:00:00Z",
      },
    };
    const result = diffIssuesForNotifications(
      baseInput({
        previousSnapshots: prev,
        assignedIssues: [issue({ id: 1, assignedToId: ME, updatedOn: "2026-08-14T09:00:00Z" })],
      }),
    );

    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0].trigger).toBe("assigned");
  });

  it("чужая задача, ничего не изменилось -> без уведомлений", () => {
    const prev: Record<number, IssueSnapshot> = {
      1: {
        statusId: 1,
        statusName: "Новая",
        isClosed: false,
        assignedToId: OTHER,
        dueDate: null,
        updatedOn: "2026-08-14T10:00:00Z",
      },
    };
    const result = diffIssuesForNotifications(
      baseInput({
        previousSnapshots: prev,
        watchedIssues: [issue({ id: 1, assignedToId: OTHER, updatedOn: "2026-08-14T10:00:00Z" })],
      }),
    );

    expect(result.notifications).toEqual([]);
  });

  it("статус моей задачи изменился -> status_changed", () => {
    const prev: Record<number, IssueSnapshot> = {
      1: {
        statusId: 1,
        statusName: "Новая",
        isClosed: false,
        assignedToId: ME,
        dueDate: null,
        updatedOn: "2026-08-14T09:00:00Z",
      },
    };
    const result = diffIssuesForNotifications(
      baseInput({
        previousSnapshots: prev,
        assignedIssues: [
          issue({ id: 1, assignedToId: ME, statusId: 2, statusName: "В работе", updatedOn: "2026-08-14T10:00:00Z" }),
        ],
      }),
    );

    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0].trigger).toBe("status_changed");
  });

  it("смена статуса чужой задачи (не моей) не файрит status_changed", () => {
    const prev: Record<number, IssueSnapshot> = {
      1: {
        statusId: 1,
        statusName: "Новая",
        isClosed: false,
        assignedToId: OTHER,
        dueDate: null,
        updatedOn: "2026-08-14T09:00:00Z",
      },
    };
    const result = diffIssuesForNotifications(
      baseInput({
        previousSnapshots: prev,
        watchedIssues: [
          issue({ id: 1, assignedToId: OTHER, statusId: 2, updatedOn: "2026-08-14T10:00:00Z" }),
        ],
      }),
    );

    expect(result.notifications.some((n) => n.trigger === "status_changed")).toBe(false);
    // но обновление всё же есть - должно засчитаться как активность
    expect(result.notifications.some((n) => n.trigger === "activity")).toBe(true);
  });

  it("новый комментарий (updated_on изменился, статус нет) по watched-задаче -> activity", () => {
    const prev: Record<number, IssueSnapshot> = {
      1: {
        statusId: 1,
        statusName: "Новая",
        isClosed: false,
        assignedToId: OTHER,
        dueDate: null,
        updatedOn: "2026-08-14T09:00:00Z",
      },
    };
    const result = diffIssuesForNotifications(
      baseInput({
        previousSnapshots: prev,
        watchedIssues: [issue({ id: 1, assignedToId: OTHER, updatedOn: "2026-08-14T11:00:00Z" })],
      }),
    );

    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0].trigger).toBe("activity");
  });

  it("assigned уже покрывает изменение updated_on - activity не дублируется", () => {
    const result = diffIssuesForNotifications(
      baseInput({
        assignedIssues: [issue({ id: 1, assignedToId: ME })],
      }),
    );

    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0].trigger).toBe("assigned");
  });

  it("status_changed уже покрывает изменение updated_on - activity не дублируется", () => {
    const prev: Record<number, IssueSnapshot> = {
      1: {
        statusId: 1,
        statusName: "Новая",
        isClosed: false,
        assignedToId: ME,
        dueDate: null,
        updatedOn: "2026-08-14T09:00:00Z",
      },
    };
    const result = diffIssuesForNotifications(
      baseInput({
        previousSnapshots: prev,
        assignedIssues: [issue({ id: 1, statusId: 2, updatedOn: "2026-08-14T10:00:00Z" })],
      }),
    );

    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0].trigger).toBe("status_changed");
  });

  it("дедлайн в пределах dueSoonDays по моей задаче -> due_soon", () => {
    const result = diffIssuesForNotifications(
      baseInput({
        previousSnapshots: {
          1: {
            statusId: 1,
            statusName: "Новая",
            isClosed: false,
            assignedToId: ME,
            dueDate: "2026-08-16",
            updatedOn: "2026-08-14T10:00:00Z",
          },
        },
        assignedIssues: [
          issue({ id: 1, dueDate: "2026-08-16", updatedOn: "2026-08-14T10:00:00Z" }),
        ],
      }),
    );

    expect(result.notifications.some((n) => n.trigger === "due_soon")).toBe(true);
    expect(result.notifiedDue[1]).toBe("2026-08-16");
  });

  it("дедлайн уже уведомлен для этой же даты -> повторно не файрит", () => {
    const result = diffIssuesForNotifications(
      baseInput({
        notifiedDue: { 1: "2026-08-16" },
        previousSnapshots: {
          1: {
            statusId: 1,
            statusName: "Новая",
            isClosed: false,
            assignedToId: ME,
            dueDate: "2026-08-16",
            updatedOn: "2026-08-14T10:00:00Z",
          },
        },
        assignedIssues: [
          issue({ id: 1, dueDate: "2026-08-16", updatedOn: "2026-08-14T10:00:00Z" }),
        ],
      }),
    );

    expect(result.notifications).toEqual([]);
    expect(result.notifiedDue[1]).toBe("2026-08-16");
  });

  it("дедлайн сдвинули на другую близкую дату -> файрит снова", () => {
    const result = diffIssuesForNotifications(
      baseInput({
        notifiedDue: { 1: "2026-08-15" },
        previousSnapshots: {
          1: {
            statusId: 1,
            statusName: "Новая",
            isClosed: false,
            assignedToId: ME,
            dueDate: "2026-08-15",
            updatedOn: "2026-08-14T10:00:00Z",
          },
        },
        assignedIssues: [
          issue({ id: 1, dueDate: "2026-08-17", updatedOn: "2026-08-14T11:00:00Z" }),
        ],
      }),
    );

    expect(result.notifications.some((n) => n.trigger === "due_soon")).toBe(true);
    expect(result.notifiedDue[1]).toBe("2026-08-17");
  });

  it("дедлайн далеко (за пределами dueSoonDays) -> не файрит", () => {
    const result = diffIssuesForNotifications(
      baseInput({
        assignedIssues: [
          issue({ id: 1, dueDate: "2026-09-01", updatedOn: "2026-08-14T10:00:00Z" }),
        ],
        previousSnapshots: {
          1: {
            statusId: 1,
            statusName: "Новая",
            isClosed: false,
            assignedToId: ME,
            dueDate: "2026-09-01",
            updatedOn: "2026-08-14T09:00:00Z",
          },
        },
      }),
    );

    expect(result.notifications.some((n) => n.trigger === "due_soon")).toBe(false);
  });

  it("закрытая задача не файрит due_soon, даже если дедлайн близко", () => {
    const result = diffIssuesForNotifications(
      baseInput({
        assignedIssues: [
          issue({
            id: 1,
            dueDate: "2026-08-15",
            isClosed: true,
            statusId: 5,
            updatedOn: "2026-08-14T10:00:00Z",
          }),
        ],
        previousSnapshots: {
          1: {
            statusId: 1,
            statusName: "Новая",
            isClosed: false,
            assignedToId: ME,
            dueDate: "2026-08-15",
            updatedOn: "2026-08-14T09:00:00Z",
          },
        },
      }),
    );

    expect(result.notifications.some((n) => n.trigger === "due_soon")).toBe(false);
  });

  it("задача одновременно в assigned и watched не дублируется", () => {
    const result = diffIssuesForNotifications(
      baseInput({
        assignedIssues: [issue({ id: 1, assignedToId: ME })],
        watchedIssues: [issue({ id: 1, assignedToId: ME })],
      }),
    );

    expect(result.notifications).toHaveLength(1);
  });
});
