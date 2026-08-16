/**
 * Хранение личных токенов GitHub/GitLab для живого статуса PR/MR - см. issue
 * #22, шаг 2. Только client-side (localStorage), тот же принцип, что и у
 * Redmine API-ключа (см. src/lib/auth-storage.ts): не логируется, не
 * проксируется на бэкенд с сохранением - только форвардится транзитом при
 * запросе статуса (src/lib/pr-mr-status.ts).
 *
 * Один токен на платформу, не на хост - используется для всех хостов этой
 * формы (github.com и self-hosted GitHub Enterprise делят один GitHub-токен,
 * аналогично для GitLab). Ограничение принято осознанно в грилинге: если
 * пользователь одновременно работает с github.com И отдельным GHE-инстансом,
 * токен будет валиден только для одного из них.
 */

const STORAGE_KEY = "redmine-client:integration-tokens";

export interface IntegrationTokens {
  github?: string;
  gitlab?: string;
}

export function loadIntegrationTokens(): IntegrationTokens {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Partial<IntegrationTokens>;
    const result: IntegrationTokens = {};
    if (typeof parsed.github === "string") result.github = parsed.github;
    if (typeof parsed.gitlab === "string") result.gitlab = parsed.gitlab;
    return result;
  } catch {
    // поврежденные данные в сторадже - считаем что их нет
  }
  return {};
}

export function saveIntegrationTokens(tokens: IntegrationTokens): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function clearIntegrationTokens(): void {
  localStorage.removeItem(STORAGE_KEY);
}
