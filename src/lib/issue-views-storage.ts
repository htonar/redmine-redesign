import type { IssueListFilters } from "@/api/issues";

export interface IssueView {
  id: string;
  name: string;
  filters: IssueListFilters;
}

/**
 * Сохраненные виды списка задач - собственный функционал поверх Redmine (не
 * путать с Query из самого Redmine, см. CLAUDE.md раздел "Список задач").
 * Ключ включает baseUrl и id пользователя - виды одного Redmine-аккаунта не
 * должны просачиваться в другой при переключении логина на этом же устройстве.
 */
function storageKey(baseUrl: string, userId: number): string {
  return `redmine-client:issue-views:${baseUrl}:${userId}`;
}

export function loadIssueViews(baseUrl: string, userId: number): IssueView[] {
  const raw = localStorage.getItem(storageKey(baseUrl, userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveIssueView(baseUrl: string, userId: number, view: IssueView): IssueView[] {
  const views = [...loadIssueViews(baseUrl, userId), view];
  localStorage.setItem(storageKey(baseUrl, userId), JSON.stringify(views));
  return views;
}

export function deleteIssueView(baseUrl: string, userId: number, viewId: string): IssueView[] {
  const views = loadIssueViews(baseUrl, userId).filter((v) => v.id !== viewId);
  localStorage.setItem(storageKey(baseUrl, userId), JSON.stringify(views));
  return views;
}
