import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ActiveFilterChips,
  activeFilterCount,
  EMPTY_ADVANCED_FILTERS,
  type AdvancedIssueFilters,
} from "@/components/issues/IssueFilterPanel";

const trackers = [
  { id: 1, name: "Bug" },
  { id: 2, name: "Feature" },
];
const priorities = [{ id: 5, name: "High" }];
const versions = [{ id: 9, name: "v1.0" }];
const members = [{ id: 11, name: "Иван" }];

describe("activeFilterCount", () => {
  it("0 для пустых фильтров", () => {
    expect(activeFilterCount(EMPTY_ADVANCED_FILTERS)).toBe(0);
  });

  it("считает каждый заданный фильтр, пробелы в subject не в счёт", () => {
    const f: AdvancedIssueFilters = {
      trackerId: 1,
      priorityId: 5,
      versionId: null,
      authorId: null,
      subject: "  ",
    };
    expect(activeFilterCount(f)).toBe(2);
    expect(activeFilterCount({ ...f, subject: "login" })).toBe(3);
  });
});

describe("ActiveFilterChips", () => {
  const base: AdvancedIssueFilters = {
    trackerId: 1,
    priorityId: null,
    versionId: 9,
    authorId: null,
    subject: "поиск",
  };

  it("рендерит чип на каждый активный фильтр с именем из справочника", () => {
    render(
      <ActiveFilterChips
        value={base}
        onChange={() => {}}
        trackers={trackers}
        priorities={priorities}
        versions={versions}
        members={members}
      />,
    );
    expect(screen.getByText("Трекер: Bug")).toBeInTheDocument();
    expect(screen.getByText("Версия: v1.0")).toBeInTheDocument();
    expect(screen.getByText("Тема: «поиск»")).toBeInTheDocument();
  });

  it("ничего не рендерит без активных фильтров", () => {
    const { container } = render(
      <ActiveFilterChips
        value={EMPTY_ADVANCED_FILTERS}
        onChange={() => {}}
        trackers={trackers}
        priorities={priorities}
        versions={versions}
        members={members}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("крестик на чипе сбрасывает только свой фильтр", async () => {
    const onChange = vi.fn();
    render(
      <ActiveFilterChips
        value={base}
        onChange={onChange}
        trackers={trackers}
        priorities={priorities}
        versions={versions}
        members={members}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Убрать фильтр: Трекер: Bug" }),
    );
    expect(onChange).toHaveBeenCalledWith({ ...base, trackerId: null });
  });
});
