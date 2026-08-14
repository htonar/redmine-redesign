import { describe, expect, it } from "vitest";
import { canManageTimeEntry } from "@/lib/time-entry-permissions";

const entry = { user: { id: 1, name: "Автор" }, project: { id: 5, name: "P" } };

function canWith(allowed: string[]) {
  return (permission: string) => allowed.includes(permission);
}

describe("canManageTimeEntry", () => {
  it("своя запись + edit_own_time_entries - можно", () => {
    expect(canManageTimeEntry(entry, 1, canWith(["edit_own_time_entries"]))).toBe(
      true,
    );
  });

  it("своя запись без прав - нельзя", () => {
    expect(canManageTimeEntry(entry, 1, canWith([]))).toBe(false);
  });

  it("чужая запись + edit_time_entries - можно", () => {
    expect(canManageTimeEntry(entry, 2, canWith(["edit_time_entries"]))).toBe(
      true,
    );
  });

  it("чужая запись без edit_time_entries - нельзя, даже если есть edit_own_time_entries", () => {
    expect(
      canManageTimeEntry(entry, 2, canWith(["edit_own_time_entries"])),
    ).toBe(false);
  });

  it("чужая запись, оба права есть - можно", () => {
    expect(
      canManageTimeEntry(
        entry,
        2,
        canWith(["edit_own_time_entries", "edit_time_entries"]),
      ),
    ).toBe(true);
  });

  it("нет текущего пользователя (currentUserId undefined) - own-ветка не срабатывает", () => {
    expect(
      canManageTimeEntry(entry, undefined, canWith(["edit_own_time_entries"])),
    ).toBe(false);
  });

  it("у записи нет project - can() вызывается с undefined projectId", () => {
    const noProject = { user: { id: 1 } };
    expect(canManageTimeEntry(noProject, 1, canWith(["edit_own_time_entries"]))).toBe(
      true,
    );
  });
});
