// Подключается один раз для всех тестов фронта (vite.config.ts, test.setupFiles).
// Добавляет DOM-матчеры (toBeInTheDocument и т.п.) для React Testing Library.
// "/vitest" - специально под Vitest'овый expect (без test.globals: true в
// конфиге глобального expect нет, обычный "@testing-library/jest-dom" на это
// и рассчитан начиная с 7.x).
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// React Testing Library регистрирует автоматический cleanup через глобальный
// afterEach, только если он виден как глобал (test.globals: true в конфиге).
// В этом проекте globals не включен (явные импорты из "vitest" везде) -
// поэтому без этого явного вызова DOM-узлы одного теста утекают в следующий
// в пределах файла (несколько компонентов в DOM одновременно, "multiple
// elements found" и т.п.).
afterEach(() => {
  cleanup();
});
