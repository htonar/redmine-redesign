/**
 * Клик по строке списка задач открывает задачу - кроме случаев, когда
 * пользователь целился в интерактивный элемент внутри строки (чекбокс,
 * ссылка, кнопка) или выделял текст мышью.
 *
 * Раньше переход делала растянутая ссылка через псевдоэлемент
 * (`after:absolute after:inset-0` на ячейке `#id`, `position: relative` на
 * `<tr>` как containing block). Но `position: relative` на `<tr>` как
 * containing block для absolute-потомков работает не во всех webview
 * (Safari / WebKitGTK, на котором крутится Tauri-сборка): overlay
 * расходился на весь вьюпорт, любой клик по таблице попадал в последнюю
 * строку и открывал последнюю задачу списка, а хедеры сортировки и
 * "выбрать все" переставали кликаться (issue #66). Поэтому переход теперь
 * явным обработчиком клика по строке, а этот предикат решает, засчитывать
 * клик за навигационный.
 */
export function isRowNavClick(
  target: EventTarget | null,
  opts: { hasTextSelection?: boolean } = {},
): boolean {
  if (opts.hasTextSelection) return false;
  if (!(target instanceof HTMLElement)) return false;
  if (
    target.closest(
      "a, button, input, label, select, textarea, [role='button'], [role='menuitem'], [role='checkbox']",
    )
  ) {
    return false;
  }
  return true;
}
