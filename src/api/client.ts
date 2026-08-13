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
  const client = createClient<paths>({
    baseUrl: fetchBaseUrl,
    // openapi-fetch по умолчанию сериализует массивы в query как повторяющиеся
    // ключи (`include=a&include=b`) - Redmine (Rails/Rack) так не понимает,
    // ждет один параметр через запятую (`include=a,b`), иначе видит только
    // последнее значение. Реальный баг, найденный на include=journals,
    // allowed_statuses,children,relations в getIssue (src/api/issues.ts) -
    // Redmine получал только "relations", остальные include молча терялись.
    querySerializer: { array: { style: "form", explode: false } },
  });

  const authMiddleware: Middleware = {
    onRequest({ request }) {
      if (auth?.apiKey) {
        request.headers.set("X-Redmine-API-Key", auth.apiKey);
      } else if (auth?.login && auth?.password) {
        request.headers.set(
          "Authorization",
          `Basic ${btoa(`${auth.login}:${auth.password}`)}`,
        );
      }
      // Не перетираем Content-Type, если он уже явно задан вызывающим кодом
      // (например, "application/octet-stream" при загрузке файла в
      // uploadAttachment - src/api/attachments.ts). По умолчанию - json, как
      // ждет большинство эндпоинтов Redmine.
      if (!request.headers.has("Content-Type")) {
        request.headers.set("Content-Type", "application/json");
      }
      if (proxyUrl) {
        request.headers.set("X-Redmine-Target", baseUrl);
      }
      return request;
    },
  };

  client.use(authMiddleware);

  return client;
}

export type RedmineClient = ReturnType<typeof createRedmineClient>;
