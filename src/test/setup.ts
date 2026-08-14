// Подключается один раз для всех тестов фронта (vite.config.ts, test.setupFiles).
// Добавляет DOM-матчеры (toBeInTheDocument и т.п.) для React Testing Library.
// "/vitest" - специально под Vitest'овый expect (без test.globals: true в
// конфиге глобального expect нет, обычный "@testing-library/jest-dom" на это
// и рассчитан начиная с 7.x).
import "@testing-library/jest-dom/vitest";
