import type { CustomFieldDefinition } from "@/api/customFields";
import type { Issue, IssueUpdateInput } from "@/api/issues";
import type { IssueFormValues } from "@/components/issues/IssueFormFields";

/**
 * Read-only отображение значения пользовательского поля на карточке
 * (вне режима правки, где типовой инпут и так показывает понятное значение
 * через CustomFieldInput). Без `definitions` (не-админ) - значение как есть
 * от Redmine ("1"/"0" для bool и т.п.) - честный fallback, не гадаем тип.
 */
export function formatCustomFieldValue(
  field: NonNullable<Issue["custom_fields"]>[number],
  definitions: CustomFieldDefinition[],
): string {
  const def = definitions.find((d) => d.id === field.id);
  const values = Array.isArray(field.value) ? field.value : [field.value];
  const formatted = values
    .filter((v): v is string => Boolean(v))
    .map((v) => {
      if (def?.field_format === "bool") return v === "1" ? "Да" : "Нет";
      const possible = def?.possible_values?.find((pv) => pv.value === v);
      return possible?.label ?? v;
    });
  return formatted.join(", ") || "—";
}

/** Патч только из полей, реально изменённых в форме - остальные не отправляем. */
export function diffFormValues(
  initial: IssueFormValues,
  current: IssueFormValues,
): IssueUpdateInput {
  const patch: IssueUpdateInput = {};
  if (current.subject !== initial.subject) patch.subject = current.subject;
  if (current.trackerId !== initial.trackerId && current.trackerId !== null) {
    patch.trackerId = current.trackerId;
  }
  if (
    current.priorityId !== initial.priorityId &&
    current.priorityId !== null
  ) {
    patch.priorityId = current.priorityId;
  }
  if (current.assignedToId !== initial.assignedToId)
    patch.assignedToId = current.assignedToId;
  if (current.categoryId !== initial.categoryId)
    patch.categoryId = current.categoryId;
  if (current.fixedVersionId !== initial.fixedVersionId) {
    patch.fixedVersionId = current.fixedVersionId;
  }
  if (current.startDate !== initial.startDate)
    patch.startDate = current.startDate || null;
  if (current.dueDate !== initial.dueDate)
    patch.dueDate = current.dueDate || null;
  if (current.doneRatio !== initial.doneRatio)
    patch.doneRatio = current.doneRatio;
  if (current.estimatedHours !== initial.estimatedHours) {
    const trimmed = current.estimatedHours.trim();
    patch.estimatedHours = trimmed ? Number(trimmed.replace(",", ".")) : null;
  }
  if (current.description !== initial.description) {
    patch.description = current.description || null;
  }
  if (
    JSON.stringify(current.customFields) !==
    JSON.stringify(initial.customFields)
  ) {
    patch.customFields = current.customFields.map((f) => ({
      id: f.id,
      value: f.value,
    }));
  }
  return patch;
}
