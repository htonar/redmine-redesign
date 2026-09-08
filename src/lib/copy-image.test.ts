import { afterEach, describe, expect, it, vi } from "vitest";
import { copyImageToClipboard } from "@/lib/copy-image";

const origClipboard = navigator.clipboard;
const origClipboardItem = (globalThis as { ClipboardItem?: unknown })
  .ClipboardItem;

afterEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: origClipboard,
    configurable: true,
  });
  (globalThis as { ClipboardItem?: unknown }).ClipboardItem = origClipboardItem;
  vi.restoreAllMocks();
});

function stubClipboard() {
  const write = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { write },
    configurable: true,
  });
  (globalThis as { ClipboardItem?: unknown }).ClipboardItem = class {
    items: Record<string, Blob>;
    constructor(items: Record<string, Blob>) {
      this.items = items;
    }
  };
  return write;
}

describe("copyImageToClipboard", () => {
  it("пишет PNG-вложение в буфер как image/png без перекодирования", async () => {
    const write = stubClipboard();
    const blob = new Blob(["fake-png"], { type: "image/png" });

    await copyImageToClipboard(blob);

    expect(write).toHaveBeenCalledOnce();
    const item = write.mock.calls[0][0][0];
    expect(item.items["image/png"]).toBe(blob);
  });

  it("бросает, если буфер обмена недоступен", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    await expect(
      copyImageToClipboard(new Blob([], { type: "image/png" })),
    ).rejects.toThrow(/недоступ/i);
  });
});
