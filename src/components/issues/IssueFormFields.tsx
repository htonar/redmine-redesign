import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Tracker } from "@/hooks/useTrackers";
import type { IssuePriority } from "@/hooks/useIssuePriorities";
import type { ProjectMember } from "@/hooks/useProjectMembers";
import type { ProjectCategory } from "@/hooks/useProjectCategories";
import type { ProjectVersion } from "@/hooks/useProjectVersions";
import { MarkdownEditor } from "@/components/markdown/MarkdownEditor";
import { UserAvatar } from "@/components/UserAvatar";
import type { UploadedFile } from "@/api/attachments";
import type { RedmineClient } from "@/api/client";

const UNASSIGNED = "none";
const DONE_RATIO_STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

/**
 * Пользовательское поле в форме. `fieldFormat`/`possibleValues` приходят из
 * GET /custom_fields.json (только для админов, см. api/customFields.ts) -
 * без них поле рендерится обычным текстовым инпутом (честный fallback, не
 * гадаем тип). См. CLAUDE.md, "Custom fields".
 */
export interface CustomFieldFormValue {
  id: number;
  name: string;
  value: string | string[];
  fieldFormat?: string;
  possibleValues?: { value?: string; label?: string }[];
  multiple?: boolean;
}

export interface IssueFormValues {
  subject: string;
  trackerId: number | null;
  priorityId: number | null;
  assignedToId: number | null;
  categoryId: number | null;
  fixedVersionId: number | null;
  startDate: string;
  dueDate: string;
  doneRatio: number;
  estimatedHours: string;
  description: string;
  customFields: CustomFieldFormValue[];
}

interface CustomFieldInputProps {
  field: CustomFieldFormValue;
  onChange: (value: string | string[]) => void;
}

/**
 * Инпут под конкретное пользовательское поле - рендер по `fieldFormat`, если
 * он известен (см. CustomFieldFormValue), иначе обычный текст. `multiple` -
 * для MVP как текст через запятую, не отдельный multi-select компонент
 * (см. CLAUDE.md, "Custom fields" - осознанное упрощение).
 */
function CustomFieldInput({ field, onChange }: CustomFieldInputProps) {
  const fieldId = useId();

  if (field.multiple) {
    const joined = Array.isArray(field.value)
      ? field.value.join(", ")
      : field.value;
    return (
      <Input
        id={fieldId}
        value={joined}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
          )
        }
        placeholder="Значения через запятую"
      />
    );
  }

  const value = Array.isArray(field.value)
    ? (field.value[0] ?? "")
    : field.value;

  if (field.fieldFormat === "bool") {
    return (
      <Select value={value || "0"} onValueChange={onChange}>
        <SelectTrigger id={fieldId} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Да</SelectItem>
          <SelectItem value="0">Нет</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (
    (field.fieldFormat === "enumeration" || field.fieldFormat === "list") &&
    field.possibleValues?.length
  ) {
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={fieldId} className="w-full">
          <SelectValue placeholder="Не выбрано" />
        </SelectTrigger>
        <SelectContent>
          {field.possibleValues.map((pv) => (
            <SelectItem key={pv.value} value={pv.value ?? ""}>
              {pv.label ?? pv.value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.fieldFormat === "date") {
    return (
      <Input
        id={fieldId}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field.fieldFormat === "int") {
    return (
      <Input
        id={fieldId}
        type="number"
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field.fieldFormat === "float") {
    return (
      <Input
        id={fieldId}
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field.fieldFormat === "text") {
    return (
      <Textarea
        id={fieldId}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <Input
      id={fieldId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export interface IssueFormFieldsProps {
  values: IssueFormValues;
  onChange: <K extends keyof IssueFormValues>(
    field: K,
    value: IssueFormValues[K],
  ) => void;
  trackers: Tracker[];
  priorities: IssuePriority[];
  members: ProjectMember[];
  categories: ProjectCategory[];
  versions: ProjectVersion[];
  /** Тема - обязательное поле, единственное, которое здесь валидируется визуально. */
  subjectRequired?: boolean;
  /** Для вставки файлов по Ctrl+V в описание (MarkdownEditor) - см. CLAUDE.md, "Markdown-редактор". */
  client: RedmineClient | null;
  onDescriptionUpload?: (file: UploadedFile) => void;
}

/**
 * Общий набор полей задачи - переиспользуется в создании (CreateIssueDialog)
 * и в режиме правки карточки (IssueDetailPage). Статус сюда сознательно не
 * входит: при создании Redmine сам подставляет статус по умолчанию трекера,
 * а при правке смена статуса - отдельный workflow-aware контрол
 * (issue.allowed_statuses), не дублируем его здесь.
 */
export function IssueFormFields({
  values,
  onChange,
  trackers,
  priorities,
  members,
  categories,
  versions,
  subjectRequired,
  client,
  onDescriptionUpload,
}: IssueFormFieldsProps) {
  const subjectId = useId();
  const trackerId = useId();
  const priorityId = useId();
  const assigneeId = useId();
  const categoryFieldId = useId();
  const versionFieldId = useId();
  const startId = useId();
  const dueId = useId();
  const doneRatioId = useId();
  const estimatedId = useId();
  const descriptionId = useId();

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Label htmlFor={subjectId} className="mb-1.5">
          Тема{subjectRequired && " *"}
        </Label>
        <Input
          id={subjectId}
          value={values.subject}
          onChange={(e) => onChange("subject", e.target.value)}
          placeholder="Коротко, о чем задача"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={trackerId} className="mb-1.5">
            Трекер
          </Label>
          <Select
            value={
              values.trackerId !== null ? String(values.trackerId) : undefined
            }
            onValueChange={(v) => onChange("trackerId", Number(v))}
          >
            <SelectTrigger id={trackerId} className="w-full">
              <SelectValue placeholder="Не выбран" />
            </SelectTrigger>
            <SelectContent>
              {trackers.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={priorityId} className="mb-1.5">
            Приоритет
          </Label>
          <Select
            value={
              values.priorityId !== null ? String(values.priorityId) : undefined
            }
            onValueChange={(v) => onChange("priorityId", Number(v))}
          >
            <SelectTrigger id={priorityId} className="w-full">
              <SelectValue placeholder="Не выбран" />
            </SelectTrigger>
            <SelectContent>
              {priorities.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor={assigneeId} className="mb-1.5">
          Исполнитель
        </Label>
        <Select
          value={
            values.assignedToId !== null
              ? String(values.assignedToId)
              : UNASSIGNED
          }
          onValueChange={(v) =>
            onChange("assignedToId", v === UNASSIGNED ? null : Number(v))
          }
        >
          <SelectTrigger id={assigneeId} className="w-full">
            <SelectValue placeholder="Не назначен" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>Не назначен</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={String(m.id)}>
                <span className="flex items-center gap-2">
                  <UserAvatar
                    name={m.name}
                    email={m.mail}
                    className="size-5"
                  />
                  {m.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={categoryFieldId} className="mb-1.5">
            Категория
          </Label>
          <Select
            value={
              values.categoryId !== null
                ? String(values.categoryId)
                : UNASSIGNED
            }
            onValueChange={(v) =>
              onChange("categoryId", v === UNASSIGNED ? null : Number(v))
            }
          >
            <SelectTrigger id={categoryFieldId} className="w-full">
              <SelectValue placeholder="Не выбрана" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Без категории</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={versionFieldId} className="mb-1.5">
            Версия
          </Label>
          <Select
            value={
              values.fixedVersionId !== null
                ? String(values.fixedVersionId)
                : UNASSIGNED
            }
            onValueChange={(v) =>
              onChange("fixedVersionId", v === UNASSIGNED ? null : Number(v))
            }
          >
            <SelectTrigger id={versionFieldId} className="w-full">
              <SelectValue placeholder="Не выбрана" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Без версии</SelectItem>
              {versions.map((v) => (
                <SelectItem key={v.id} value={String(v.id)}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={startId} className="mb-1.5">
            Начало
          </Label>
          <Input
            id={startId}
            type="date"
            value={values.startDate}
            onChange={(e) => onChange("startDate", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={dueId} className="mb-1.5">
            Срок
          </Label>
          <Input
            id={dueId}
            type="date"
            value={values.dueDate}
            onChange={(e) => onChange("dueDate", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={doneRatioId} className="mb-1.5">
            Готовность
          </Label>
          <Select
            value={String(values.doneRatio)}
            onValueChange={(v) => onChange("doneRatio", Number(v))}
          >
            <SelectTrigger id={doneRatioId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DONE_RATIO_STEPS.map((step) => (
                <SelectItem key={step} value={String(step)}>
                  {step}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={estimatedId} className="mb-1.5">
            Оценка часов
          </Label>
          <Input
            id={estimatedId}
            type="number"
            min={0}
            step={0.5}
            placeholder="Необязательно"
            value={values.estimatedHours}
            onChange={(e) => onChange("estimatedHours", e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor={descriptionId} className="mb-1.5">
          Описание
        </Label>
        <MarkdownEditor
          id={descriptionId}
          client={client}
          rows={5}
          value={values.description}
          onChange={(v) => onChange("description", v)}
          onUpload={onDescriptionUpload}
          placeholder="Необязательно"
        />
      </div>

      {values.customFields.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <div className="text-xs font-medium text-muted-foreground">
            Дополнительные поля
          </div>
          {values.customFields.map((field, i) => (
            <div key={field.id}>
              <Label className="mb-1.5">{field.name}</Label>
              <CustomFieldInput
                field={field}
                onChange={(value) => {
                  const next = values.customFields.slice();
                  next[i] = { ...field, value };
                  onChange("customFields", next);
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
