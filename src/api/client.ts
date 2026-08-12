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
}

/**
 * Creates a typed Redmine REST API client based on the generated OpenAPI schema.
 * The schema is generated from https://github.com/d-yoshi/redmine-openapi via
 * `npm run api:generate` - see api/redmine-openapi.yaml.
 */
export function createRedmineClient({ baseUrl, auth }: RedmineClientOptions) {
  const client = createClient<paths>({ baseUrl });

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
      request.headers.set("Content-Type", "application/json");
      return request;
    },
  };

  client.use(authMiddleware);

  return client;
}

export type RedmineClient = ReturnType<typeof createRedmineClient>;
