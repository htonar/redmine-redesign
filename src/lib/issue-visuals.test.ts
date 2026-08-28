import { describe, expect, it } from "vitest";
import {
  dueDateState,
  priorityTone,
  statusTone,
} from "@/lib/issue-visuals";

describe("priorityTone", () => {
  it("Immediate/Urgent -> danger", () => {
    expect(priorityTone("Immediate")).toBe("danger");
    expect(priorityTone("Срочный")).toBe("danger");
    expect(priorityTone("URGENT")).toBe("danger");
  });
  it("High -> warning", () => {
    expect(priorityTone("High")).toBe("warning");
    expect(priorityTone("Высокий")).toBe("warning");
  });
  it("Normal -> neutral, Low -> muted", () => {
    expect(priorityTone("Normal")).toBe("neutral");
    expect(priorityTone("Низкий")).toBe("muted");
    expect(priorityTone(undefined)).toBe("neutral");
  });
});

describe("statusTone", () => {
  it("закрытые -> muted", () => {
    expect(statusTone({ name: "Closed", is_closed: true })).toBe("muted");
    expect(statusTone({ name: "Что-то", is_closed: true })).toBe("muted");
  });
  it("resolved (не закрыт) -> success", () => {
    expect(statusTone({ name: "Resolved", is_closed: false })).toBe("success");
    expect(statusTone({ name: "Решён", is_closed: false })).toBe("success");
  });
  it("rejected -> danger", () => {
    expect(statusTone({ name: "Rejected", is_closed: true })).toBe("danger");
  });
  it("in progress -> progress, feedback -> info", () => {
    expect(statusTone({ name: "In Progress", is_closed: false })).toBe("progress");
    expect(statusTone({ name: "Feedback", is_closed: false })).toBe("info");
  });
  it("new / прочее открытое -> info", () => {
    expect(statusTone({ name: "New", is_closed: false })).toBe("info");
  });
});

describe("dueDateState", () => {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  it("прошлое -> overdue", () => {
    const y = new Date();
    y.setDate(y.getDate() - 2);
    expect(dueDateState(iso(y))).toBe("overdue");
  });
  it("в пределах soonDays -> soon", () => {
    const t = new Date();
    t.setDate(t.getDate() + 2);
    expect(dueDateState(iso(t))).toBe("soon");
  });
  it("далеко -> ok", () => {
    const t = new Date();
    t.setDate(t.getDate() + 30);
    expect(dueDateState(iso(t))).toBe("ok");
  });
  it("закрытая задача -> ok даже если просрочена", () => {
    const y = new Date();
    y.setDate(y.getDate() - 10);
    expect(dueDateState(iso(y), true)).toBe("ok");
  });
  it("нет даты -> null", () => {
    expect(dueDateState(null)).toBe(null);
    expect(dueDateState(undefined)).toBe(null);
  });
});
