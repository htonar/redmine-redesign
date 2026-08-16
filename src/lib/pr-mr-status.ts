import { isTauri } from "@tauri-apps/api/core";
import { tauriFetch } from "../api/tauriFetch";
import type { IntegrationTokens } from "./integration-tokens-storage";
import type { PrMrLink } from "./pr-mr-links";

/**
 * Живой статус PR/MR - см. issue #22, шаг 2. "draft" - персональный статус
 * GitHub PR (draft: true) и GitLab MR (work_in_progress / draft), выше
 * приоритетом отображения, чем open/closed - см. MarkdownContent.tsx.
 */
export type PrMrStatus = "open" | "merged" | "closed" | "draft";

export interface PrMrStatusOptions {
  tokens: IntegrationTokens;
  /**
   * Базовый URL прокси (тот же VITE_REDMINE_PROXY_URL, что и у
   * createRedmineClient) - нужен только для GitLab в веб-сборке, GitLab
   * нигде не отдает CORS (gitlab-org/gitlab-foss#24596). GitHub CORS
   * поддерживает нативно, здесь не используется. В Tauri тоже не
   * используется - там свой invoke-путь через tauriFetch.
   */
  proxyUrl?: string;
}

// Кэш на сессию, без авто-обновления (осознанный выбор из грилинга) - ключ по
// url ссылки, значение undefined тоже кэшируется (неудача не повторяется на
// каждый рендер).
const cache = new Map<string, PrMrStatus | undefined>();

export function clearPrMrStatusCache(): void {
  cache.clear();
}

/**
 * Возвращает живой статус PR/MR либо undefined - при любой ошибке (нет
 * токена, невалидный/просроченный токен, 404, rate-limit, сеть недоступна,
 * GitLab без настроенного прокси) - тихий фолбэк на статичный чип, без
 * пользовательских ошибок (решено в грилинге).
 */
export async function getPrMrStatus(
  link: PrMrLink,
  options: PrMrStatusOptions,
): Promise<PrMrStatus | undefined> {
  if (cache.has(link.url)) return cache.get(link.url);

  const status = await fetchPrMrStatus(link, options).catch(() => undefined);
  cache.set(link.url, status);
  return status;
}

async function fetchPrMrStatus(
  link: PrMrLink,
  options: PrMrStatusOptions,
): Promise<PrMrStatus | undefined> {
  if (link.platform === "github") {
    return fetchGithubStatus(link, options.tokens.github);
  }
  return fetchGitlabStatus(link, options.tokens.gitlab, options.proxyUrl);
}

async function fetchGithubStatus(
  link: PrMrLink,
  token: string | undefined,
): Promise<PrMrStatus | undefined> {
  if (!link.owner || !link.repo) return undefined;

  // github.com - api.github.com; self-hosted GitHub Enterprise Server -
  // {host}/api/v3, тот же путь ниже. Оба поддерживают CORS нативно.
  const apiBase =
    link.host === "github.com" ? "https://api.github.com" : `https://${link.host}/api/v3`;
  const url = `${apiBase}/repos/${link.owner}/${link.repo}/pulls/${link.number}`;

  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) return undefined;

  const data = (await response.json()) as { state: string; merged: boolean; draft: boolean };
  if (data.draft) return "draft";
  if (data.merged) return "merged";
  return data.state === "closed" ? "closed" : "open";
}

async function fetchGitlabStatus(
  link: PrMrLink,
  token: string | undefined,
  proxyUrl: string | undefined,
): Promise<PrMrStatus | undefined> {
  if (!link.projectPath) return undefined;

  const apiPath = `/api/v4/projects/${encodeURIComponent(link.projectPath)}/merge_requests/${link.number}`;
  const headers: Record<string, string> = {};
  if (token) headers["Private-Token"] = token;

  let response: Response;
  if (isTauri()) {
    // Десктоп: тот же generic invoke("proxy_request", ...) путь, что и для
    // Redmine (src-tauri/src/proxy.rs, FORWARDED_REQUEST_HEADERS содержит
    // private-token) - идем прямо на GitLab, X-Proxy-Target не нужен, reqwest
    // не подчиняется CORS.
    response = await tauriFetch(new Request(`https://${link.host}${apiPath}`, { headers }));
  } else {
    // Веб: тот же универсальный /proxy/* механизм, что и у Redmine-клиента
    // (server/src/app.ts), с X-Proxy-Target вместо прямого адреса.
    if (!proxyUrl) return undefined;
    headers["X-Proxy-Target"] = `https://${link.host}`;
    response = await fetch(`${proxyUrl.replace(/\/+$/, "")}/proxy${apiPath}`, { headers });
  }

  if (!response.ok) return undefined;

  const data = (await response.json()) as {
    state: string;
    draft?: boolean;
    work_in_progress?: boolean;
  };
  if (data.draft || data.work_in_progress) return "draft";
  if (data.state === "merged") return "merged";
  return data.state === "closed" ? "closed" : "open";
}
