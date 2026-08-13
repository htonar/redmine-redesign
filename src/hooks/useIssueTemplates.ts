import { useCallback, useState } from "react";
import {
  deleteIssueTemplate,
  loadIssueTemplates,
  saveIssueTemplate,
  type IssueTemplate,
} from "@/lib/issue-templates-storage";

/** Управление шаблонами задач по типам - обертка над localStorage, по образцу useIssueViews. */
export function useIssueTemplates(
  baseUrl: string | null,
  userId: number | undefined,
) {
  const [templates, setTemplates] = useState<IssueTemplate[]>(() =>
    baseUrl && userId ? loadIssueTemplates(baseUrl, userId) : [],
  );

  const save = useCallback(
    (template: Omit<IssueTemplate, "id">) => {
      if (!baseUrl || !userId) return;
      const full: IssueTemplate = { ...template, id: crypto.randomUUID() };
      setTemplates(saveIssueTemplate(baseUrl, userId, full));
    },
    [baseUrl, userId],
  );

  const remove = useCallback(
    (templateId: string) => {
      if (!baseUrl || !userId) return;
      setTemplates(deleteIssueTemplate(baseUrl, userId, templateId));
    },
    [baseUrl, userId],
  );

  return { templates, save, remove };
}
