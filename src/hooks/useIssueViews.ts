import { useCallback, useState } from "react";
import type { IssueListFilters } from "@/api/issues";
import {
  deleteIssueView,
  loadIssueViews,
  saveIssueView,
  type IssueView,
} from "@/lib/issue-views-storage";

/** Управление сохраненными видами списка задач - обертка над localStorage. */
export function useIssueViews(baseUrl: string | null, userId: number | undefined) {
  const [views, setViews] = useState<IssueView[]>(() =>
    baseUrl && userId ? loadIssueViews(baseUrl, userId) : [],
  );

  const save = useCallback(
    (name: string, filters: IssueListFilters) => {
      if (!baseUrl || !userId) return;
      const view: IssueView = { id: crypto.randomUUID(), name, filters };
      setViews(saveIssueView(baseUrl, userId, view));
    },
    [baseUrl, userId],
  );

  const remove = useCallback(
    (viewId: string) => {
      if (!baseUrl || !userId) return;
      setViews(deleteIssueView(baseUrl, userId, viewId));
    },
    [baseUrl, userId],
  );

  return { views, save, remove };
}
