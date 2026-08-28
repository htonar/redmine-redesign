import { useNavigate } from "react-router";
import { JournalEntry } from "@/components/issues/JournalEntry";
import type { ActivityEntry } from "@/hooks/useActivityFeed";
import type { JournalValueMaps } from "@/lib/journal-format";

interface ActivityFeedProps {
  entries: ActivityEntry[];
  /** id -> имя для полей истории (статус/приоритет/трекер/исполнитель) - issue #30. */
  valueMaps?: JournalValueMaps;
}

/** Лента изменений/комментариев по своим задачам - см. useActivityFeed. */
export function ActivityFeed({ entries, valueMaps }: ActivityFeedProps) {
  const navigate = useNavigate();

  if (entries.length === 0) {
    return (
      <p className="px-4 py-4 text-sm text-muted-foreground">
        За последнее время изменений по вашим задачам не найдено
      </p>
    );
  }

  return (
    <div className="flex flex-col px-4">
      {entries.map((entry) => (
        <JournalEntry
          key={entry.journal.id}
          journal={entry.journal}
          valueMaps={valueMaps}
          header={
            <button
              type="button"
              onClick={() => navigate(`/issues/${entry.issueId}`)}
              className="text-left text-sm font-medium hover:underline"
            >
              #{entry.issueId} {entry.issueSubject}
            </button>
          }
        />
      ))}
    </div>
  );
}
