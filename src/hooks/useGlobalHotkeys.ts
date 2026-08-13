import { useEffect, useRef } from "react";

export interface GlobalHotkeyHandlers {
  /** g i - к списку задач */
  onNavigateIssues?: () => void;
  /** g d - на дашборд */
  onNavigateDashboard?: () => void;
  /** g t - к учету времени */
  onNavigateTime?: () => void;
  /** c - создать задачу */
  onCreateIssue?: () => void;
  /** / - фокус в глобальный поиск */
  onFocusSearch?: () => void;
  /** ? - показать подсказку по горячим клавишам */
  onShowHelp?: () => void;
}

const G_SEQUENCE_TIMEOUT_MS = 800;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

function isDialogOpen(): boolean {
  return document.querySelector('[data-slot="dialog-content"]') !== null;
}

/**
 * Глобальные горячие клавиши (по образцу Linear/Gmail) - только когда фокус
 * не в поле ввода и не открыт диалог (иначе "c"/"e" перехватывались бы
 * посреди ввода текста в форме). `g` работает как префикс двухклавишной
 * последовательности (g+i/g+d/g+t) с таймаутом - одиночная "g" ничего не
 * делает, пока не придет вторая клавиша.
 */
export function useGlobalHotkeys(handlers: GlobalHotkeyHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let awaitingG = false;
    let gTimeout: ReturnType<typeof setTimeout> | null = null;

    function resetG() {
      awaitingG = false;
      if (gTimeout) clearTimeout(gTimeout);
      gTimeout = null;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target) || isDialogOpen()) return;

      const key = e.key.toLowerCase();
      const h = handlersRef.current;

      if (awaitingG) {
        resetG();
        if (key === "i" && h.onNavigateIssues) {
          e.preventDefault();
          h.onNavigateIssues();
        } else if (key === "d" && h.onNavigateDashboard) {
          e.preventDefault();
          h.onNavigateDashboard();
        } else if (key === "t" && h.onNavigateTime) {
          e.preventDefault();
          h.onNavigateTime();
        }
        return;
      }

      if (key === "g") {
        awaitingG = true;
        gTimeout = setTimeout(resetG, G_SEQUENCE_TIMEOUT_MS);
        return;
      }

      if (key === "c" && h.onCreateIssue) {
        e.preventDefault();
        h.onCreateIssue();
      } else if (key === "/" && h.onFocusSearch) {
        e.preventDefault();
        h.onFocusSearch();
      } else if (e.key === "?" && h.onShowHelp) {
        e.preventDefault();
        h.onShowHelp();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      resetG();
    };
  }, []);
}
