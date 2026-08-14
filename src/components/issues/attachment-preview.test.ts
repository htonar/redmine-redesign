import { describe, expect, it } from "vitest";
import { getPreviewKind, isPreviewableTextSize } from "@/components/issues/attachment-preview";

describe("getPreviewKind", () => {
  it("image/* -> image", () => {
    expect(getPreviewKind("image/png")).toBe("image");
    expect(getPreviewKind("image/jpeg")).toBe("image");
  });

  it("video/* -> video", () => {
    expect(getPreviewKind("video/mp4")).toBe("video");
  });

  it("text/* -> text", () => {
    expect(getPreviewKind("text/plain")).toBe("text");
    expect(getPreviewKind("text/markdown")).toBe("text");
  });

  it("известные текстовые application/* -> text", () => {
    expect(getPreviewKind("application/json")).toBe("text");
    expect(getPreviewKind("application/xml")).toBe("text");
  });

  it("прочие типы -> unsupported", () => {
    expect(getPreviewKind("application/zip")).toBe("unsupported");
    expect(getPreviewKind("application/pdf")).toBe("unsupported");
  });

  it("null/undefined -> unsupported", () => {
    expect(getPreviewKind(null)).toBe("unsupported");
    expect(getPreviewKind(undefined)).toBe("unsupported");
  });
});

describe("isPreviewableTextSize", () => {
  it("файл в пределах лимита - можно превьюить", () => {
    expect(isPreviewableTextSize(1024)).toBe(true);
  });

  it("файл больше лимита - нельзя, чтобы не тянуть мегабайты текста только ради превью", () => {
    expect(isPreviewableTextSize(10 * 1024 * 1024)).toBe(false);
  });
});
