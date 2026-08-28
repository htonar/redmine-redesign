/**
 * Инициалы и цвет для аватарки пользователя, когда картинки (Gravatar) нет
 * или email недоступен - см. UserAvatar. Чистые функции, тестируются отдельно.
 */

/** "Иван Петров" -> "ИП"; "Redmine Admin (я)" -> "RA". Одно слово -> первая буква. */
export function initialsFromName(name: string): string {
  const words = name
    .replace(/\([^)]*\)/g, "") // убрать "(я)" и т.п.
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Детерминированный цвет фона аватарки по имени - чтобы список пользователей
 * визуально различался. Тейлвиндовые классы (перечислены статически, иначе
 * JIT их не соберёт).
 */
const AVATAR_BG = [
  "bg-red-500/15 text-red-600 dark:text-red-400",
  "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "bg-pink-500/15 text-pink-600 dark:text-pink-400",
];

export function avatarColorClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_BG[Math.abs(hash) % AVATAR_BG.length];
}
