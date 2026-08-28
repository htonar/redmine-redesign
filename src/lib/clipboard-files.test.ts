import { describe, expect, it } from "vitest";
import {
  extractClipboardFiles,
  GENERIC_PASTE_NAME,
  renameFile,
  uniquePasteName,
} from "@/lib/clipboard-files";

/** Мини-моки DataTransferItem/DataTransfer - jsdom их полноценно не реализует. */
function fileItem(file: File): DataTransferItem {
  return {
    kind: "file",
    type: file.type,
    getAsFile: () => file,
    getAsString: () => undefined,
    webkitGetAsEntry: () => null,
  } as unknown as DataTransferItem;
}

function stringItem(value: string): DataTransferItem {
  return {
    kind: "string",
    type: "text/plain",
    getAsFile: () => null,
    getAsString: (cb: (s: string) => void) => cb(value),
    webkitGetAsEntry: () => null,
  } as unknown as DataTransferItem;
}

function dataTransfer(opts: {
  files?: File[];
  items?: DataTransferItem[];
}): DataTransfer {
  return {
    files: opts.files ?? [],
    items: opts.items ?? [],
  } as unknown as DataTransfer;
}

const png = (name = "a.png") =>
  new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" });

describe("extractClipboardFiles", () => {
  it("возвращает пустой массив без данных", () => {
    expect(extractClipboardFiles(null)).toEqual([]);
    expect(extractClipboardFiles(undefined)).toEqual([]);
    expect(extractClipboardFiles(dataTransfer({}))).toEqual([]);
  });

  it("берёт файлы из DataTransfer.files (копия из файлового менеджера)", () => {
    const f = png();
    expect(extractClipboardFiles(dataTransfer({ files: [f] }))).toEqual([f]);
  });

  it("берёт файл из items, когда files пустой (вставка картинки из буфера)", () => {
    const f = png("clipboard.png");
    const result = extractClipboardFiles(
      dataTransfer({ files: [], items: [fileItem(f)] }),
    );
    expect(result).toEqual([f]);
  });

  it("игнорирует строковые items (обычный текст)", () => {
    const result = extractClipboardFiles(
      dataTransfer({ items: [stringItem("просто текст")] }),
    );
    expect(result).toEqual([]);
  });

  it("не дублирует файл, попавший и в files, и в items", () => {
    const f = png();
    const result = extractClipboardFiles(
      dataTransfer({ files: [f], items: [fileItem(f)] }),
    );
    expect(result).toEqual([f]);
  });

  it("собирает несколько разных файлов", () => {
    const a = png("a.png");
    const b = png("b.png");
    const result = extractClipboardFiles(
      dataTransfer({ items: [fileItem(a), fileItem(b)] }),
    );
    expect(result).toEqual([a, b]);
  });
});

describe("GENERIC_PASTE_NAME", () => {
  it("совпадает с дефолтными именами картинок из буфера", () => {
    expect(GENERIC_PASTE_NAME.test("image.png")).toBe(true);
    expect(GENERIC_PASTE_NAME.test("image")).toBe(true);
    expect(GENERIC_PASTE_NAME.test(".png")).toBe(true);
    expect(GENERIC_PASTE_NAME.test("screenshot.png")).toBe(true);
  });

  it("не трогает осмысленные имена файлов", () => {
    expect(GENERIC_PASTE_NAME.test("diagram.png")).toBe(false);
    expect(GENERIC_PASTE_NAME.test("a.png")).toBe(false);
    expect(GENERIC_PASTE_NAME.test("отчёт-2026.pdf")).toBe(false);
  });
});

describe("uniquePasteName", () => {
  it("сохраняет расширение из имени файла", () => {
    expect(uniquePasteName(png("image.png"))).toMatch(/^pasted-\d+-[a-z0-9]{4}\.png$/);
  });

  it("восстанавливает расширение из MIME-типа, если в имени его нет", () => {
    const f = new File([new Uint8Array([1])], "image", { type: "image/jpeg" });
    expect(uniquePasteName(f)).toMatch(/\.jpg$/);
  });

  it("даёт разные имена при повторных вызовах", () => {
    const f = png("image.png");
    expect(uniquePasteName(f)).not.toBe(uniquePasteName(f));
  });
});

describe("renameFile", () => {
  it("возвращает File с новым именем, сохраняя тип и содержимое", async () => {
    const f = png("image.png");
    const renamed = renameFile(f, "pasted-1.png");
    expect(renamed.name).toBe("pasted-1.png");
    expect(renamed.type).toBe("image/png");
    expect(renamed.size).toBe(f.size);
  });
});
