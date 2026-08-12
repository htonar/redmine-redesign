import type { IssueRelationType } from "@/api/issues";

/**
 * Русские подписи типов связи "от текущей задачи" - когда текущая задача
 * является issue_id в relation (т.е. это направление, в котором связь была
 * создана). См. RELATION_TYPE_INVERSE для обратного случая.
 */
export const RELATION_TYPE_LABELS: Record<IssueRelationType, string> = {
  relates: "Связана с",
  duplicates: "Дублирует",
  duplicated: "Дублируется",
  blocks: "Блокирует",
  blocked: "Заблокирована",
  precedes: "Предшествует",
  follows: "Следует за",
  copied_to: "Скопирована в",
  copied_from: "Скопирована из",
};

/**
 * Обратный тип связи - Redmine хранит relation направленно (issue_id ->
 * issue_to_id), а показывать её нужно корректно с обеих сторон (например,
 * если A "blocks" B, то со стороны B это "blocked"). Используется, когда
 * текущая задача - issue_to_id в relation.
 */
export const RELATION_TYPE_INVERSE: Record<IssueRelationType, IssueRelationType> = {
  relates: "relates",
  duplicates: "duplicated",
  duplicated: "duplicates",
  blocks: "blocked",
  blocked: "blocks",
  precedes: "follows",
  follows: "precedes",
  copied_to: "copied_from",
  copied_from: "copied_to",
};

/** Варианты для выпадающего списка при добавлении новой связи. */
export const RELATION_TYPE_OPTIONS: { value: IssueRelationType; label: string }[] = [
  { value: "relates", label: "Связана с" },
  { value: "blocks", label: "Блокирует" },
  { value: "blocked", label: "Заблокирована" },
  { value: "precedes", label: "Предшествует" },
  { value: "follows", label: "Следует за" },
  { value: "duplicates", label: "Дублирует" },
  { value: "duplicated", label: "Дублируется" },
  { value: "copied_to", label: "Скопирована в" },
  { value: "copied_from", label: "Скопирована из" },
];
