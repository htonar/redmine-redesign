/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * URL прокси-сервера (server/), обходящего отсутствие CORS у Redmine.
   * См. CLAUDE.md, раздел "CORS и прокси-бэкенд". Опционально.
   */
  readonly VITE_REDMINE_PROXY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
