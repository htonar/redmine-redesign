import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";

export interface RedmineAuth {
  /** Redmine API key (sent as X-Redmine-API-Key header). Preferred over login/password. */
  apiKey?: string;
  /** HTTP Basic auth login, used only if apiKey is not set. */
  login?: string;
  /** HTTP Basic auth password, used only if apiKey is not set. */
  password?: string;
}

export interface RedmineClientOptions {
  /** Base URL of the Redmine instance, e.g. "https://redmine.example.com". */
  baseUrl: string;
  auth?: RedmineAuth;
  /**
   * Базовый URL прокси-сервера (server/), если он используется. Большинство
   * Redmine-инстансов не отдают CORS-заголовки, поэтому браузер напрямую до них
   * не достучится - см. CLAUDE.md, раздел "CORS и прокси-бэкенд". Когда задан,
   * запросы идут на `${proxyUrl}/proxy/...` с заголовком X-Redmine-Target,
   * вместо прямого обращения к `baseUrl`.
   */
  proxyUrl?: string;
}

/**
 * Creates a typed Redmine REST API client based on the generated OpenAPI schema.
 * The schema is generated from https://github.com/d-yoshi/redmine-openapi via
 * `npm run api:generate` - see api/redmine-openapi.yaml.
 */
export function createRedmineClient({ baseUrl, auth, proxyUrl }: RedmineClientOptions) {
  const fetchBaseUrl = proxyUrl ? `${proxyUrl.replace(/\/+$/, "")}/proxy` : baseUrl;
  const client = createClient<paths>({ baseUrl: fetchBaseUrl });

  function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (auth?.apiKey) {
      headers["X-Redmine-API-Key"] = auth.apiKey;
    } else if (auth?.login && auth?.password) {
      headers["Authorization"] = `Basic ${btoa(`${auth.login}:${auth.password}`)}`;
    }
    if (proxyUrl) {
      headers["X-Redmine-Target"] = baseUrl;
    }
    return headers;
  }

  const authMiddleware: Middleware = {
    onRequest({ request }) {
      for (const [name, value] of Object.entries(authHeaders())) {
        request.headers.set(name, value);
      }
      request.headers.set("Content-Type", "application/json");
      return request;
    },
  };

  client.use(authMiddleware);

  /**
   * Сырой fetch к тому же инстансу (через прокси или напрямую) с теми же
   * заголовками авторизации, что и у типизированного клиента выше - нужен
   * там, где openapi-fetch не годится: например, загрузка файла на
   * `/uploads.json` ждет сырое бинарное тело, а не JSON (см.
   * src/api/files.ts). `path` - без базового URL, начинается с `/`.
   */
  function rawFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    for (const [name, value] of Object.entries(authHeaders())) {
      headers.set(name, value);
    }
    return fetch(`${fetchBaseUrl}${path}`, { ...init, headers });
  }

  return Object.assign(client, { rawFetch });
}

export type RedmineClient = ReturnType<typeof createRedmineClient>;
