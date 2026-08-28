/**
 * Промпт для генерации англоязычного slug имени ветки по теме задачи
 * (issue #27). Чистая функция, тестируется отдельно от AI-клиента
 * (src/api/ai.ts). Используется, только если пользователь включил
 * "использовать AI" и настроил AI-ассистента.
 */

import type { AiMessage } from "@/api/ai";

const SYSTEM_PROMPT =
  "You turn a task title into a git branch slug. Output ONLY the slug: " +
  "lowercase ASCII, words separated by single hyphens, no more than 5 words, " +
  "characters [a-z0-9-] only. Translate non-English titles to English. " +
  "No quotes, no prefixes like feature/ or fix/, no explanations, no trailing period.";

export function buildBranchSlugMessages(subject: string): [AiMessage, AiMessage] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: subject.trim() || "task" },
  ];
}
