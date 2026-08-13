import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";
import { getIssueSummary, type IssueSummary } from "@/api/issues";

/**
 * Подгружает краткие карточки (тема/трекер/статус) для произвольного набора
 * id задач - нужно для отображения ссылок на родителя и связанные задачи на
 * карточке задачи: `issue.parent`/`issue.relations` отдают только `{ id }`,
 * без темы. Каждый id - отдельный `GET`, т.к. фильтр `issue_id` в списке
 * задач по спеке поддерживает только один id/диапазон, не произвольный
 * список через "|" (см. src/api/schema.d.ts, getIssuesByProject.issue_id).
 * Результаты копятся между вызовами (не сбрасываются при смене набора id),
 * чтобы не было мигания уже показанных тем при добавлении новой связи.
 */
export function useIssueSummaries(client: RedmineClient | null, ids: number[]) {
  const key = Array.from(new Set(ids)).sort((a, b) => a - b).join(",");
  const [summaries, setSummaries] = useState<Record<number, IssueSummary>>({});

  useEffect(() => {
    if (!client || !key) return;
    const idsToFetch = key.split(",").map(Number);
    let cancelled = false;

    Promise.all(
      idsToFetch.map((id) =>
        getIssueSummary(client, id)
          .then((summary) => [id, summary] as const)
          .catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return;
      setSummaries((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r) next[r[0]] = r[1];
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, key]);

  return summaries;
}
