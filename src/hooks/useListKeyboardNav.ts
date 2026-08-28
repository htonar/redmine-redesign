import { useEffect, useRef, useState } from "react";

/** Фокус в поле ввода / открытый диалог - хоткеи навигации не перехватываем. */
function shouldIgnore(target: EventTarget | null): boolean {
  if (document.querySelector('[data-slot="dialog-content"]')) return true;
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable ||
    // Radix Select/Popover открыт - стрелки нужны ему
    target.closest('[role="listbox"],[role="menu"],[data-radix-popper-content-wrapper]') !==
      null
  );
}

/**
 * j/k (и ↑/↓) двигают подсвеченный элемент списка, Enter открывает его
 * (issue #46). Сбрасывает индекс при смене массива `items`. Возвращает
 * текущий индекс и ref-callback для скролла активного элемента в видимую
 * область.
 */
export function useListKeyboardNav<T>(
  items: T[],
  onEnter: (item: T, index: number) => void,
  enabled = true,
) {
  const [index, setIndex] = useState(-1);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const activeElRef = useRef<HTMLElement | null>(null);

  // Смена набора (фильтр/сортировка) - сбрасываем подсветку.
  useEffect(() => {
    setIndex(-1);
  }, [items]);

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (shouldIgnore(e.target)) return;
      const n = itemsRef.current.length;
      if (n === 0) return;
      const key = e.key.toLowerCase();

      if (key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => Math.min(n - 1, i + 1));
      } else if (key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => (i <= 0 ? 0 : i - 1));
      } else if (e.key === "Enter") {
        setIndex((i) => {
          if (i >= 0 && i < itemsRef.current.length) {
            e.preventDefault();
            onEnter(itemsRef.current[i], i);
          }
          return i;
        });
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, onEnter]);

  useEffect(() => {
    activeElRef.current?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const setActiveRef = (el: HTMLElement | null) => {
    activeElRef.current = el;
  };

  return { index, setActiveRef };
}
