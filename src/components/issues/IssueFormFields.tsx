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

const UNASSIGNED = "none";
const DONE_RATIO_STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

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
}

export interface IssueFormFieldsProps {
  values: IssueFormValues;
  onChange: <K extends keyof IssueFormValues>(field: K, value: IssueFormValues[K]) => void;
  trackers: Tracker[];
  priorities: IssuePriority[];
  members: ProjectMember[];
  categories: ProjectCategory[];
  versions: ProjectVersion[];
  /** Тема - обязательное поле, единственное, которое здесь валидируется визуально. */
  subjectRequired?: boolean;
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={trackerId} className="mb-1.5">
            Трекер
          </Label>
          <Select
            value={values.trackerId !== null ? String(values.trackerId) : undefined}
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
            value={values.priorityId !== null ? String(values.priorityId) : undefined}
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
          value={values.assignedToId !== null ? String(values.assignedToId) : UNASSIGNED}
          onValueChange={(v) => onChange("assignedToId", v === UNASSIGNED ? null : Number(v))}
        >
          <SelectTrigger id={assigneeId} className="w-full">
            <SelectValue placeholder="Не назначен" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>Не назначен</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={String(m.id)}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={categoryFieldId} className="mb-1.5">
            Категория
          </Label>
          <Select
            value={values.categoryId !== null ? String(values.categoryId) : UNASSIGNED}
            onValueChange={(v) => onChange("categoryId", v === UNASSIGNED ? null : Number(v))}
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
            value={values.fixedVersionId !== null ? String(values.fixedVersionId) : UNASSIGNED}
            onValueChange={(v) => onChange("fixedVersionId", v === UNASSIGNED ? null : Number(v))}
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

      <div className="grid grid-cols-2 gap-3">
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

      <div className="grid grid-cols-2 gap-3">
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
        <Textarea
          id={descriptionId}
          rows={5}
          value={values.description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="Необязательно"
        />
      </div>
    </div>
  );
}
