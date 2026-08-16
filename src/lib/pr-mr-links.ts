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
 */

export interface PrMrLink {
  platform: "github" | "gitlab";
  url: string;
  number: number;
}

const CHAR_CLASS_EXCLUDE = `\\s)>\\]"'`;

// https://<host>/<owner>/<repo>/pull/<n> - host/owner/repo - однословные
// сегменты пути (без "/"), как у GitHub и GitHub Enterprise.
const GITHUB_PR_RE =
  /(https?:\/\/[^\s/]+\/[^\s/]+\/[^\s/]+\/pull\/(\d+))/gi;

// https://<host>/<любой путь>/-/merge_requests/<n> - namespace может быть
// вложенным (группы/подгруппы), поэтому путь до "/-/merge_requests/" не
// фиксирован по числу сегментов, в отличие от GitHub.
const GITLAB_MR_RE = new RegExp(
  `(https?:\\/\\/[^${CHAR_CLASS_EXCLUDE}]+?\\/-\\/merge_requests\\/(\\d+))`,
  "gi",
);

interface RawMatch extends PrMrLink {
  index: number;
}

function collectMatches(
  text: string,
  re: RegExp,
  platform: PrMrLink["platform"],
): RawMatch[] {
  return [...text.matchAll(re)].map((match) => ({
    platform,
    url: match[1],
    number: Number(match[2]),
    index: match.index,
  }));
}

export function extractPrMrLinks(text: string): PrMrLink[] {
  const matches = [
    ...collectMatches(text, GITHUB_PR_RE, "github"),
    ...collectMatches(text, GITLAB_MR_RE, "gitlab"),
  ].sort((a, b) => a.index - b.index);

  const seen = new Set<string>();
  const result: PrMrLink[] = [];
  for (const { platform, url, number } of matches) {
    if (seen.has(url)) continue;
    seen.add(url);
    result.push({ platform, url, number });
  }
  return result;
}
