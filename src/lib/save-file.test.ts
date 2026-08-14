import { afterEach, describe, expect, it, vi } from "vitest";
import { saveBlobAs } from "@/lib/save-file";

function makeBlob(text = "hello"): Blob {
  return new Blob([text], { type: "text/plain" });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("saveBlobAs", () => {
  it("когда showSaveFilePicker доступен - открывает системный диалог и пишет в выбранный файл", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const createWritable = vi.fn().mockResolvedValue({ write, close });
    const showSaveFilePicker = vi.fn().mockResolvedValue({ createWritable });
    vi.stubGlobal("showSaveFilePicker", showSaveFilePicker);

    const blob = makeBlob();
    await saveBlobAs(blob, "report.txt");

    expect(showSaveFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: "report.txt" }),
    );
    expect(createWritable).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith(blob);
    expect(close).toHaveBeenCalledOnce();
  });

  it("пользователь закрыл системный диалог (AbortError) - тихо ничего не делает", async () => {
    const showSaveFilePicker = vi
      .fn()
      .mockRejectedValue(new DOMException("cancelled", "AbortError"));
    vi.stubGlobal("showSaveFilePicker", showSaveFilePicker);

    await expect(saveBlobAs(makeBlob(), "report.txt")).resolves.toBeUndefined();
  });

  it("другая ошибка при записи - пробрасывается наружу", async () => {
    const showSaveFilePicker = vi.fn().mockRejectedValue(new Error("disk full"));
    vi.stubGlobal("showSaveFilePicker", showSaveFilePicker);

    await expect(saveBlobAs(makeBlob(), "report.txt")).rejects.toThrow("disk full");
  });

  it("showSaveFilePicker недоступен (напр. Firefox) - падает на обычное скачивание", async () => {
    vi.stubGlobal("showSaveFilePicker", undefined);
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag: string) => {
        if (tag === "a") {
          return { click: clickSpy, href: "", download: "" } as unknown as HTMLAnchorElement;
        }
        return originalCreateElement(tag);
      });
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue("blob:mock"),
      revokeObjectURL: vi.fn(),
    });

    await saveBlobAs(makeBlob(), "report.txt");

    expect(clickSpy).toHaveBeenCalledOnce();
    createElementSpy.mockRestore();
  });
});
