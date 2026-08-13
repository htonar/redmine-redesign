export interface IssueTemplate {
  id: string;
  name: string;
  trackerId: number | null;
  priorityId: number | null;
  categoryId: number | null;
  description: string;
}

/**
 * Дефолтные шаблоны - подставляются один раз при первом обращении к разделу
 * (см. loadIssueTemplates), чтобы список не был пустым с самого начала.
 * trackerId/priorityId/categoryId - null: id трекеров/приоритетов не
 * переносимы между инстансами Redmine (разные наборы, разная локализация
 * названий) - безопасно предзаполнить можно только текст, трекер/приоритет
 * пользователь выбирает сам после применения шаблона. Пользовательские
 * шаблоны (через "Сохранить как шаблон" в форме) сохраняют реальные id -
 * они снимаются с уже загруженных для конкретного инстанса справочников.
 */
const DEFAULT_TEMPLATES: Omit<IssueTemplate, "id">[] = [
  {
    name: "Баг",
    trackerId: null,
    priorityId: null,
    categoryId: null,
    description:
      "### Шаги воспроизведения\n1. \n2. \n\n### Ожидаемое поведение\n\n\n### Фактическое поведение\n",
  },
  {
    name: "Улучшение",
    trackerId: null,
    priorityId: null,
    categoryId: null,
    description: "### Что улучшить\n\n\n### Зачем это нужно\n",
  },
  {
    name: "Задача",
    trackerId: null,
    priorityId: null,
    categoryId: null,
    description: "### Что нужно сделать\n\n\n### Критерии готовности\n- [ ] \n",
  },
];

/**
 * Шаблоны задач по типам - собственный функционал поверх Redmine (REST API
 * не отдает сущности "шаблон задачи"), по образцу сохраненных видов списка
 * (см. issue-views-storage.ts). Ключ включает baseUrl и id пользователя -
 * шаблоны одного Redmine-аккаунта не должны просачиваться в другой при
 * переключении логина на этом же устройстве.
 */
function storageKey(baseUrl: string, userId: number): string {
  return `redmine-client:issue-templates:${baseUrl}:${userId}`;
}

function seedDefaults(baseUrl: string, userId: number): IssueTemplate[] {
  const seeded = DEFAULT_TEMPLATES.map((t) => ({
    ...t,
    id: crypto.randomUUID(),
  }));
  localStorage.setItem(storageKey(baseUrl, userId), JSON.stringify(seeded));
  return seeded;
}

export function loadIssueTemplates(
  baseUrl: string,
  userId: number,
): IssueTemplate[] {
  const raw = localStorage.getItem(storageKey(baseUrl, userId));
  if (!raw) return seedDefaults(baseUrl, userId);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : seedDefaults(baseUrl, userId);
  } catch {
    return seedDefaults(baseUrl, userId);
  }
}

export function saveIssueTemplate(
  baseUrl: string,
  userId: number,
  template: IssueTemplate,
): IssueTemplate[] {
  const templates = [...loadIssueTemplates(baseUrl, userId), template];
  localStorage.setItem(storageKey(baseUrl, userId), JSON.stringify(templates));
  return templates;
}

export function deleteIssueTemplate(
  baseUrl: string,
  userId: number,
  templateId: string,
): IssueTemplate[] {
  const templates = loadIssueTemplates(baseUrl, userId).filter(
    (t) => t.id !== templateId,
  );
  localStorage.setItem(storageKey(baseUrl, userId), JSON.stringify(templates));
  return templates;
}
