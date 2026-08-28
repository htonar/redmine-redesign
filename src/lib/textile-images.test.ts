import { describe, expect, it } from "vitest";
import {
  parseImageTitle,
  textileImagesToMarkdown,
} from "@/lib/textile-images";

describe("textileImagesToMarkdown", () => {
  it("простая Textile-картинка -> markdown", () => {
    expect(textileImagesToMarkdown("см. !clipboard-1.png! ниже")).toBe(
      "см. ![clipboard-1.png](clipboard-1.png) ниже",
    );
  });

  it("вставка из буфера со стилем width - размер уезжает в title", () => {
    expect(
      textileImagesToMarkdown("!{width: 680px}.clipboard-202608261432-v8hhf.png!"),
    ).toBe(
      '![clipboard-202608261432-v8hhf.png](clipboard-202608261432-v8hhf.png "width=680px")',
    );
  });

  it("width и height вместе", () => {
    expect(
      textileImagesToMarkdown("!{width: 680px; height: 383px}.a.png!"),
    ).toBe('![a.png](a.png "width=680px height=383px")');
  });

  it("alt в скобках", () => {
    expect(textileImagesToMarkdown("!diagram.png(Схема потоков)!")).toBe(
      "![Схема потоков](diagram.png)",
    );
  });

  it("картинка-ссылка (!img!:url) -> [![](img)](url)", () => {
    expect(textileImagesToMarkdown("!thumb.png!:https://example.com/full")).toBe(
      "[![thumb.png](thumb.png)](https://example.com/full)",
    );
  });

  it("выравнивание игнорируется, картинка всё равно рендерится", () => {
    expect(textileImagesToMarkdown("!>photo.jpg!")).toBe(
      "![photo.jpg](photo.jpg)",
    );
  });

  it("абсолютный URL", () => {
    expect(
      textileImagesToMarkdown("!https://cdn.example.com/pic.png!"),
    ).toBe("![pic.png](https://cdn.example.com/pic.png)");
  });

  it("видео тоже конвертируется (тег выберет MarkdownContent по типу)", () => {
    expect(textileImagesToMarkdown("!screencast.mp4!")).toBe(
      "![screencast.mp4](screencast.mp4)",
    );
  });

  it("НЕ трогает `!текст!` без расширения файла (ложные срабатывания)", () => {
    const s = "это !важно! и !очень важно! для нас";
    expect(textileImagesToMarkdown(s)).toBe(s);
  });

  it("НЕ трогает уже markdown-картинку", () => {
    const s = "![alt](clipboard-1.png)";
    expect(textileImagesToMarkdown(s)).toBe(s);
  });

  it("несколько картинок в тексте", () => {
    expect(textileImagesToMarkdown("!a.png! текст !b.gif!")).toBe(
      "![a.png](a.png) текст ![b.gif](b.gif)",
    );
  });

  it("без '!' в тексте возвращает как есть", () => {
    expect(textileImagesToMarkdown("обычный текст")).toBe("обычный текст");
  });
});

describe("parseImageTitle", () => {
  it("пусто -> {}", () => {
    expect(parseImageTitle(undefined)).toEqual({});
    expect(parseImageTitle("")).toEqual({});
  });

  it("width/height из нашего формата", () => {
    expect(parseImageTitle("width=680px height=383px")).toEqual({
      width: "680px",
      height: "383px",
    });
    expect(parseImageTitle("width=50%")).toEqual({ width: "50%" });
  });

  it("обычный title отдаётся как title, не как размеры", () => {
    expect(parseImageTitle("Скриншot ошибки")).toEqual({
      title: "Скриншot ошибки",
    });
  });
});
