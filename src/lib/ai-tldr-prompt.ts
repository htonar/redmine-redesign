/**
 * Сборка сообщений для TL;DR обсуждения задачи (issue #23) - чистая
 * функция, тестируется отдельно от AI-клиента (src/api/ai.ts). В контекст
 * уходит вся история без обрезки (осознанное решение из грилинга -
 * современные бесплатные модели тянут 128k+ токенов).
 */

import type { AiMessage } from "@/api/ai";
import { FIELD_LABELS } from "./journal-format";

export interface TldrJournal {
  id: number;
  notes: string;
  details: { property: string; name: string; old_value: string | null; new_value: string | null }[];
}

const SYSTEM_PROMPT =
  "Ты помощник разработчика в трекере задач. Кратко суммаризируй обсуждение " +
  "задачи в 2-3 предложениях. Отвечай всегда на русском языке, независимо " +
  "от языка исходного текста. Не добавляй вступлений вроде «Вот саммари» - " +
  "сразу переходи к сути.";

function formatJournalEntry(journal: TldrJournal): string | undefined {
  const parts: string[] = [];

  if (journal.notes.trim()) {
    parts.push(journal.notes.trim());
  }

  for (const detail of journal.details) {
    const label = FIELD_LABELS[detail.name] ?? detail.name;
    parts.push(`${label}: ${detail.old_value ?? "—"} → ${detail.new_value ?? "—"}`);
  }

  if (parts.length === 0) return undefined;
  return parts.join("\n");
}

export function buildTldrMessages(
  description: string | undefined,
  journals: TldrJournal[],
): [AiMessage, AiMessage] {
  const sections: string[] = [];

  if (description?.trim()) {
    sections.push(`Описание задачи:\n${description.trim()}`);
  }

  const historyEntries = journals.map(formatJournalEntry).filter((entry): entry is string => Boolean(entry));

  if (historyEntries.length > 0) {
    sections.push(`История обсуждения:\n${historyEntries.join("\n\n")}`);
  }

  const content = sections.length > 0 ? sections.join("\n\n") : "У задачи пока нет описания и истории.";

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content },
  ];
}
