import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// defineConfig берём из "vitest/config" (drop-in реэкспорт vite's defineConfig
// с добавленными типами поля `test`), а не из "vite" - один конфиг-файл на
// оба инструмента, alias "@" не дублируется отдельно для тестов.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    watch: {
      // src-tauri/target - директория Rust-сборки (Cargo.toml), не фронтовый
      // код - Vite не должен её watch'ить. Без этого dev-сервер падает с
      // EBUSY на файлах вроде target/debug/deps/app_lib.dll, залоченных
      // текущим cargo-процессом, стоит запустить `cargo check`/`tauri dev`
      // хоть раз (см. официальный Tauri+Vite quickstart).
      ignored: ['**/src-tauri/**'],
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
