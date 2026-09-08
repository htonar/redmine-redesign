import { describe, expect, it } from "vitest";
import { htmlImagesToMarkdown } from "@/lib/html-images";
import { parseImageTitle } from "@/lib/textile-images";

describe("htmlImagesToMarkdown", () => {
  it("переписывает <img> из буфера с inline-стилем ширины в markdown", () => {
    const out = htmlImagesToMarkdown(
      '<img style="width: 1920px;" src="clipboard-202609071029-pyuv0.png"><br>',
    );
    expect(out).toBe(
      '![clipboard-202609071029-pyuv0.png](clipboard-202609071029-pyuv0.png "width=1920px")<br>',
    );
  });

  it("размер из inline-стиля разбирается parseImageTitle обратно", () => {
    const md = htmlImagesToMarkdown(
      '<img style="width: 1920px; height: 1080px" src="a.png">',
    );
    const title = md.match(/"([^"]*)"/)?.[1];
    expect(parseImageTitle(title)).toEqual({ width: "1920px", height: "1080px" });
  });

  it("width/height как HTML-атрибуты без единиц считает пикселями", () => {
    expect(
      htmlImagesToMarkdown('<img src="a.png" width="640" height="480">'),
    ).toBe('![a.png](a.png "width=640px height=480px")');
  });

  it("берёт alt из тега, если он есть", () => {
    expect(htmlImagesToMarkdown('<img src="a.png" alt="схема">')).toBe(
      "![схема](a.png)",
    );
  });

  it("одинарные кавычки и другой порядок атрибутов", () => {
    expect(htmlImagesToMarkdown("<img src='pic.jpg' style='width:50%'>")).toBe(
      '![pic.jpg](pic.jpg "width=50%")',
    );
  });

  it("абсолютный URL в src сохраняется, alt - имя файла", () => {
    expect(
      htmlImagesToMarkdown('<img src="https://x.test/img/foo.png">'),
    ).toBe("![foo.png](https://x.test/img/foo.png)");
  });

  it("несколько картинок в тексте", () => {
    const out = htmlImagesToMarkdown(
      'до <img src="a.png"> между <img src="b.png"> после',
    );
    expect(out).toBe("до ![a.png](a.png) между ![b.png](b.png) после");
  });

  it("<img> без src не трогает", () => {
    expect(htmlImagesToMarkdown("<img alt='нет источника'>")).toBe(
      "<img alt='нет источника'>",
    );
  });

  it("текст без картинок возвращает как есть", () => {
    expect(htmlImagesToMarkdown("обычное описание без html")).toBe(
      "обычное описание без html",
    );
    expect(htmlImagesToMarkdown("")).toBe("");
  });

  it("не путает <img> с обычным markdown", () => {
    const md = "![уже markdown](c.png)";
    expect(htmlImagesToMarkdown(md)).toBe(md);
  });
});
