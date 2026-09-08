import { afterEach, describe, expect, it, vi } from "vitest";

const isTauriMock = vi.fn();
const readImageMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => isTauriMock(),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readImage: () => readImageMock(),
}));

import { readTauriClipboardImage } from "@/lib/tauri-clipboard";

afterEach(() => vi.clearAllMocks());

describe("readTauriClipboardImage", () => {
  it("не десктоп-сборка - сразу null, плагин не трогаем", async () => {
    isTauriMock.mockReturnValue(false);
    expect(await readTauriClipboardImage()).toBeNull();
    expect(readImageMock).not.toHaveBeenCalled();
  });

  it("в буфере не картинка (readImage бросает) - null", async () => {
    isTauriMock.mockReturnValue(true);
    readImageMock.mockRejectedValue(new Error("no image in clipboard"));
    expect(await readTauriClipboardImage()).toBeNull();
  });

  it("пустой размер картинки - null", async () => {
    isTauriMock.mockReturnValue(true);
    readImageMock.mockResolvedValue({
      rgba: async () => new Uint8Array(0),
      size: async () => ({ width: 0, height: 0 }),
    });
    expect(await readTauriClipboardImage()).toBeNull();
  });

  it("данных меньше, чем width*height*4 - null (не пытаемся кодировать битое)", async () => {
    isTauriMock.mockReturnValue(true);
    readImageMock.mockResolvedValue({
      rgba: async () => new Uint8Array(10),
      size: async () => ({ width: 4, height: 4 }),
    });
    expect(await readTauriClipboardImage()).toBeNull();
  });
});
