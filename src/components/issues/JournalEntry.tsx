import type { ReactNode } from "react";
import type { Issue } from "@/api/issues";
import { FIELD_LABELS, formatDateTime } from "@/lib/journal-format";

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
}

/** Одна запись истории изменений/комментарий - переиспользуется в карточке задачи и в ленте активности. */
export function JournalEntry({
  journal,
  header,
  customFieldNames,
}: JournalEntryProps) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0">
      {header}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {journal.user?.name ?? "Кто-то"}
        </span>
        {formatDateTime(journal.created_on)}
      </div>
      {journal.notes && (
        <p className="text-sm whitespace-pre-wrap">{journal.notes}</p>
      )}
      {journal.details.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {journal.details.map((d, i) => {
            const label =
              d.property === "cf"
                ? (customFieldNames?.[Number(d.name)] ?? `Поле #${d.name}`)
                : (FIELD_LABELS[d.name] ?? d.name);
            return (
              <li key={i}>
                {label}: {d.old_value ?? "—"} → {d.new_value ?? "—"}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
