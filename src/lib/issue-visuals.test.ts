import { describe, expect, it } from "vitest";
import {
  dueDateState,
  priorityTone,
  statusTone,
} from "@/lib/issue-visuals";

describe("priorityTone по имени (фолбэк)", () => {
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

describe("priorityTone по позиции в справочнике", () => {
  // Порядок как отдаёт API - по возрастанию важности, is_default = "обычный".
  const ordered = [
    { id: 1, isDefault: false }, // низкий
    { id: 2, isDefault: true }, // обычный
    { id: 3, isDefault: false }, // высокий
    { id: 4, isDefault: false }, // очень высокий
    { id: 5, isDefault: false }, // критический (верхний)
  ];
  it("ниже дефолта -> muted, дефолт -> neutral", () => {
    expect(priorityTone({ id: 1, name: "Мороженка" }, ordered)).toBe("muted");
    expect(priorityTone({ id: 2, name: "как угодно" }, ordered)).toBe("neutral");
  });
  it("выше дефолта -> warning, самый верхний -> danger", () => {
    expect(priorityTone({ id: 3 }, ordered)).toBe("warning");
    expect(priorityTone({ id: 4 }, ordered)).toBe("warning");
    expect(priorityTone({ id: 5 }, ordered)).toBe("danger");
  });
  it("произвольные названия не влияют - работает позиция", () => {
    const weird = [
      { id: 10, isDefault: true },
      { id: 20, isDefault: false },
    ];
    expect(priorityTone({ id: 10, name: "Blocker" }, weird)).toBe("neutral");
    expect(priorityTone({ id: 20, name: "Trivial" }, weird)).toBe("danger");
  });
  it("id не найден в справочнике -> откат на имя", () => {
    expect(priorityTone({ id: 999, name: "High" }, ordered)).toBe("warning");
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
