/**
 * Распознавание ссылок на GitHub PR / GitLab MR в тексте задачи - см. issue
 * #22, шаг 1. Чисто текстовый разбор (regex по сырому markdown-исходнику),
 * без сетевых запросов и без привязки к конкретному домену - работает и на
 * github.com/gitlab.com, и на self-hosted GitHub Enterprise/GitLab (те
 * сохраняют тот же путь: `/{owner}/{repo}/pull/{n}` и `/-/merge_requests/{n}`
 * соответственно). Обычные ссылки на issue (`/issues/{n}`) сознательно вне
 * скоупа - только PR/MR.
 *
 * Разбор идёт по сырому тексту, а не по markdown AST - ловит и голые URL, и
 * `[text](url)` одинаково, без кастомизации рендера ссылок в MarkdownContent.
 *
 * host/owner/repo/projectPath (шаг 2, issue #22) - структурные поля,
 * извлечённые из url, нужны для построения запросов к REST API
 * GitHub/GitLab при получении живого статуса (см. src/lib/pr-mr-status.ts).
 * API base URL для self-hosted выводится из host на месте вызова, отдельного
 * поля под него здесь нет.
 */

export interface PrMrLink {
  platform: "github" | "gitlab";
  url: string;
  number: number;
  host: string;
  /** Только для platform: "github". */
  owner?: string;
  /** Только для platform: "github". */
  repo?: string;
  /** Только для platform: "gitlab" - полный путь проекта, может быть вложенным (группы/подгруппы). */
  projectPath?: string;
}

const CHAR_CLASS_EXCLUDE = `\\s)>\\]"'`;

// https://<host>/<owner>/<repo>/pull/<n> - host/owner/repo - однословные
// сегменты пути (без "/"), как у GitHub и GitHub Enterprise.
const GITHUB_PR_RE =
  /(https?:\/\/([^\s/]+)\/([^\s/]+)\/([^\s/]+)\/pull\/(\d+))/gi;

// https://<host>/<любой путь>/-/merge_requests/<n> - namespace может быть
// вложенным (группы/подгруппы), поэтому путь до "/-/merge_requests/" не
// фиксирован по числу сегментов, в отличие от GitHub.
const GITLAB_MR_RE = new RegExp(
  `(https?:\\/\\/([^${CHAR_CLASS_EXCLUDE}]+?)\\/([^${CHAR_CLASS_EXCLUDE}]+?)\\/-\\/merge_requests\\/(\\d+))`,
  "gi",
);

interface RawMatch extends PrMrLink {
  index: number;
}

function collectGithubMatches(text: string): RawMatch[] {
  return [...text.matchAll(GITHUB_PR_RE)].map((match) => ({
    platform: "github",
    url: match[1],
    host: match[2],
    owner: match[3],
    repo: match[4],
    number: Number(match[5]),
    index: match.index,
  }));
}

function collectGitlabMatches(text: string): RawMatch[] {
  return [...text.matchAll(GITLAB_MR_RE)].map((match) => ({
    platform: "gitlab",
    url: match[1],
    host: match[2],
    projectPath: match[3],
    number: Number(match[4]),
    index: match.index,
  }));
}

export function extractPrMrLinks(text: string): PrMrLink[] {
  const matches = [...collectGithubMatches(text), ...collectGitlabMatches(text)].sort(
    (a, b) => a.index - b.index,
  );

  const seen = new Set<string>();
  const result: PrMrLink[] = [];
  for (const { index: _index, ...link } of matches) {
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    result.push(link);
  }
  return result;
}
