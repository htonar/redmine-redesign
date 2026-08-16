import { afterEach, describe, expect, it, vi } from "vitest";

const isTauriMock = vi.fn(() => false);
const openUrlMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => isTauriMock(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: (url: string) => openUrlMock(url),
}));

import { openExternal } from "./open-external";

describe("openExternal", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("зовет плагин opener в Tauri вместо window.open", async () => {
    isTauriMock.mockReturnValue(true);
    const windowOpenSpy = vi.spyOn(window, "open").mockReturnValue(null);

    await openExternal("https://redmine.example.com/issues/1");

    expect(openUrlMock).toHaveBeenCalledWith(
      "https://redmine.example.com/issues/1",
    );
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it("в вебе открывает через window.open, плагин не зовет", async () => {
    isTauriMock.mockReturnValue(false);
    const windowOpenSpy = vi.spyOn(window, "open").mockReturnValue(null);

    await openExternal("https://redmine.example.com/issues/1");

    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://redmine.example.com/issues/1",
      "_blank",
      "noreferrer",
    );
    expect(openUrlMock).not.toHaveBeenCalled();
  });
});
