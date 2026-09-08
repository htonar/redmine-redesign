import { describe, expect, it } from "vitest";
import { isRowNavClick } from "@/lib/table-row-nav";

function el(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root.firstElementChild as HTMLElement;
}

describe("isRowNavClick", () => {
  it("клик по обычной ячейке засчитывается за навигацию", () => {
    const cell = el("<div><span>Починить сборку</span></div>");
    expect(isRowNavClick(cell.querySelector("span"))).toBe(true);
  });

  it("клик по ссылке внутри строки не навигирует (ссылка сама уведёт)", () => {
    const link = el('<a href="/issues/1">#1</a>');
    expect(isRowNavClick(link)).toBe(false);
  });

  it("клик по вложенному в ссылку элементу тоже не навигирует", () => {
    const link = el('<a href="/issues/1"><svg></svg></a>');
    expect(isRowNavClick(link.querySelector("svg"))).toBe(false);
  });

  it("клик по чекбоксу выбора не навигирует", () => {
    const box = el('<input type="checkbox" />');
    expect(isRowNavClick(box)).toBe(false);
  });

  it("клик по кнопке не навигирует", () => {
    const btn = el("<button>x</button>");
    expect(isRowNavClick(btn)).toBe(false);
  });

  it("выделение текста подавляет навигацию", () => {
    const cell = el("<div><span>текст</span></div>");
    expect(
      isRowNavClick(cell.querySelector("span"), { hasTextSelection: true }),
    ).toBe(false);
  });

  it("не падает на нестандартном target", () => {
    expect(isRowNavClick(null)).toBe(false);
    expect(isRowNavClick(new EventTarget())).toBe(false);
  });
});
