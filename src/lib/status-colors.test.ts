import { describe, expect, it } from "vitest";
import {
  isStatusColorChoice,
  normalizeStatusName,
  resolveStatusToneOverrides,
  setStatusColorChoice,
  type StatusColorMap,
} from "@/lib/status-colors";

describe("normalizeStatusName", () => {
  it("тримит и приводит к нижнему регистру", () => {
    expect(normalizeStatusName("  На Согласовании  ")).toBe("на согласовании");
    expect(normalizeStatusName(null)).toBe("");
  });
});

describe("isStatusColorChoice", () => {
  it("принимает известные тоны и auto", () => {
    expect(isStatusColorChoice("auto")).toBe(true);
    expect(isStatusColorChoice("danger")).toBe(true);
  });
  it("отбрасывает мусор", () => {
    expect(isStatusColorChoice("rainbow")).toBe(false);
    expect(isStatusColorChoice(42)).toBe(false);
  });
});

describe("resolveStatusToneOverrides", () => {
  it("оставляет только явные тоны, ключи нормализует", () => {
    const map: StatusColorMap = {
      "Заморожен": "info",
      "На ревью": "auto",
      " Ожидает Оплаты ": "warning",
    };
    expect(resolveStatusToneOverrides(map)).toEqual({
      "заморожен": "info",
      "ожидает оплаты": "warning",
    });
  });
  it("мусорные значения игнорируются", () => {
    expect(
      resolveStatusToneOverrides({ x: "nope" as never, y: "success" }),
    ).toEqual({ y: "success" });
  });
  it("пустая/отсутствующая карта - пустой результат", () => {
    expect(resolveStatusToneOverrides(null)).toEqual({});
    expect(resolveStatusToneOverrides({})).toEqual({});
  });
});

describe("setStatusColorChoice", () => {
  it("добавляет выбор по нормализованному ключу", () => {
    expect(setStatusColorChoice({}, "Заморожен", "info")).toEqual({
      "заморожен": "info",
    });
  });
  it("auto убирает ключ", () => {
    expect(
      setStatusColorChoice({ "заморожен": "info" }, "Заморожен", "auto"),
    ).toEqual({});
  });
  it("не мутирует исходную карту", () => {
    const map: StatusColorMap = { "в работе": "progress" };
    setStatusColorChoice(map, "в работе", "danger");
    expect(map).toEqual({ "в работе": "progress" });
  });
});
