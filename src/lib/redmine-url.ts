/**
 * Ссылки на сущности в штатном веб-Redmine (не наш API-клиент) - см. issue
 * #20 "Открыть в Redmine": для того, что сознательно не реализуем в
 * собственном UI (Gantt, wiki, репозитории, тонкая настройка, см.
 * "Приоритеты" в CLAUDE.md), нужен явный выход в оригинальный интерфейс.
 *
 * `baseUrl` берётся из AuthContext - он уже нормализован (без trailing
 * slash) через normalizeBaseUrl при логине, дополнительная нормализация
 * здесь не нужна.
 */

export function issueUrl(baseUrl: string, issueId: number): string {
  return `${baseUrl}/issues/${issueId}`;
}

export function projectUrl(
  baseUrl: string,
  projectIdentifier: number | string,
): string {
  return `${baseUrl}/projects/${projectIdentifier}`;
}
