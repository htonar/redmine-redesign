import type { ReactNode } from "react";
import type { Issue } from "@/api/issues";
import type { Attachment } from "@/api/attachments";
import type { RedmineClient } from "@/api/client";
import {
  FIELD_LABELS,
  resolveJournalFieldValue,
  type JournalValueMaps,
} from "@/lib/journal-format";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { formatRelativeTime, fullTimestamp } from "@/lib/relative-time";

interface JournalEntryProps {
  journal: NonNullable<Issue["journals"]>[number];
  /**
   * Доп. контент над строкой автор/дата - например ссылка на задачу, когда
   * запись показывается вне карточки самой задачи (лента активности на
   * дашборде, см. ActivityFeed).
   */
  header?: ReactNode;
  /**
   * id -> имя пользовательского поля - записи об изменении custom field
   * приходят с `property: "cf"` и `name` = id поля строкой (не имя!), без
   * этой карты запись показывала бы голый номер поля вместо подписи. Строится
   * из useCustomFieldDefinitions на стороне вызывающего - опционально,
   * ActivityFeed на дашборде его не грузит (N+1 ради ленты не оправдан),
   * такие записи там покажут "Поле #N" вместо имени, это не баг, а fallback.
   */
  customFieldNames?: Record<number, string>;
  /**
   * Карты id -> имя для полей типа status_id/priority_id/tracker_id и т.п.
   * (см. resolveJournalFieldValue) - без них история показывает голые
   * числа. Опционально по тем же причинам, что и customFieldNames -
   * ActivityFeed на дашборде их не грузит, там записи об изменении этих
   * полей показывают id как fallback.
   */
  valueMaps?: JournalValueMaps;
  /**
   * Вложения задачи и клиент - для резолва картинок, вставленных по Ctrl+V
   * прямо в комментарий (см. MarkdownContent). Опционально - ActivityFeed на
   * дашборде их не грузит, комментарии там просто без инлайн-картинок.
   */
  attachments?: Attachment[];
  client?: RedmineClient | null;
}

/** Одна запись истории изменений/комментарий - переиспользуется в карточке задачи и в ленте активности. */
export function JournalEntry({
  journal,
  header,
  customFieldNames,
  valueMaps,
  attachments,
  client,
}: JournalEntryProps) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0">
      {header}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {journal.user?.name ?? "Кто-то"}
        </span>
        <span title={fullTimestamp(journal.created_on)}>
          {formatRelativeTime(journal.created_on)}
        </span>
      </div>
      {journal.notes && (
        <MarkdownContent
          text={journal.notes}
          attachments={attachments}
          client={client}
        />
      )}
      {journal.details.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {journal.details.map((d, i) => {
            const label =
              d.property === "cf"
                ? (customFieldNames?.[Number(d.name)] ?? `Поле #${d.name}`)
                : (FIELD_LABELS[d.name] ?? d.name);
            const oldValue = resolveJournalFieldValue(
              d.name,
              d.old_value,
              valueMaps ?? {},
            );
            const newValue = resolveJournalFieldValue(
              d.name,
              d.new_value,
              valueMaps ?? {},
            );
            return (
              <li key={i}>
                {label}: {oldValue} → {newValue}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
