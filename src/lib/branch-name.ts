/**
 * Генерация имени git-ветки по задаче (issue #27) - чистые функции, вся
 * работа с localStorage/AI/буфером обмена в компоненте.
 *
 * Шаблон - строка с плейсхолдерами:
 *   {type}    - fix/feature/... по трекеру задачи (см. resolveBranchType)
 *   {id}      - номер задачи
 *   {slug}    - тема задачи, приведённая к kebab-case ASCII (см. slugify)
 *   {tracker} - имя трекера как есть (slug-form)
 *   {project} - идентификатор проекта
 */

import { transliterate } from "@/lib/transliterate";

export const DEFAULT_BRANCH_TEMPLATE = "{type}/#{id}-{slug}";

/**
 * Имя трекера (в нижнем регистре) -> префикс ветки. Всё, чего нет в карте -
 * DEFAULT_BRANCH_TYPE.
 */
export const DEFAULT_TYPE_MAP: Record<string, string> = {
  bug: "fix",
  баг: "fix",
  дефект: "fix",
  ошибка: "fix",
  "bug fix": "fix",
  hotfix: "hotfix",
};

export const DEFAULT_BRANCH_TYPE = "feature";

export interface BranchNameConfig {
  template: string;
  typeMap: Record<string, string>;
  useAi: boolean;
}

export const DEFAULT_BRANCH_NAME_CONFIG: BranchNameConfig = {
  template: DEFAULT_BRANCH_TEMPLATE,
  typeMap: DEFAULT_TYPE_MAP,
  useAi: false,
};

export interface SlugifyOptions {
  maxWords?: number;
  maxLength?: number;
}

/**
 * Тема задачи -> kebab-case ASCII: транслитерация кириллицы, нижний регистр,
 * всё не-[a-z0-9] в дефисы, схлопывание, обрезка по словам и длине.
 */
export function slugify(text: string, opts: SlugifyOptions = {}): string {
  const { maxWords = 6, maxLength = 50 } = opts;

  let s = transliterate(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!s) return "";

  let words = s.split("-").filter(Boolean);
  if (words.length > maxWords) words = words.slice(0, maxWords);
  s = words.join("-");

  if (s.length > maxLength) {
    s = s.slice(0, maxLength).replace(/-+[^-]*$/, "").replace(/-+$/, "");
    // если единственное слово длиннее лимита - просто режем
    if (!s) s = transliterate(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, maxLength).replace(/-+$/, "");
  }

  return s;
}

/** Префикс ветки по имени трекера задачи. */
export function resolveBranchType(
  trackerName: string | undefined | null,
  typeMap: Record<string, string> = DEFAULT_TYPE_MAP,
  fallback: string = DEFAULT_BRANCH_TYPE,
): string {
  if (!trackerName) return fallback;
  const key = trackerName.trim().toLowerCase();
  return typeMap[key] ?? fallback;
}

/**
 * Убирает из строки то, что git не пускает в имя ссылки: пробелы, `..`,
 * управляющие символы, `~^:?*[\`, ведущие/повторные/замыкающие слэши, точку
 * в конце сегмента, суффикс `.lock`.
 */
export function sanitizeBranchName(name: string): string {
  let s = name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[~^:?*[\]\\]/g, "")
    .replace(/\.\.+/g, ".")
    .replace(/@\{/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, "");

  s = s
    .split("/")
    .map((seg) =>
      seg
        .replace(/^\.+|\.+$/g, "")
        .replace(/\.lock$/i, "")
        .replace(/^-+|-+$/g, ""),
    )
    .filter(Boolean)
    .join("/");

  return s.replace(/^\/+|\/+$/g, "").replace(/-+/g, "-");
}

export interface BranchNameVars {
  id: number;
  slug: string;
  type: string;
  tracker?: string;
  project?: string;
}

/** Подставляет плейсхолдеры в шаблон и чистит результат под git. */
export function renderBranchName(template: string, vars: BranchNameVars): string {
  const filled = template
    .replace(/\{type\}/g, vars.type)
    .replace(/\{id\}/g, String(vars.id))
    .replace(/\{slug\}/g, vars.slug)
    .replace(/\{tracker\}/g, vars.tracker ? slugify(vars.tracker, { maxWords: 3 }) : "")
    .replace(/\{project\}/g, vars.project ? slugify(vars.project, { maxWords: 4 }) : "");
  return sanitizeBranchName(filled);
}
