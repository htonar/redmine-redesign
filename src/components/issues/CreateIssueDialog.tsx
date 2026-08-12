import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IssueFormFields, type IssueFormValues } from "@/components/issues/IssueFormFields";
import type { RedmineClient } from "@/api/client";
import type { Project } from "@/hooks/useProjects";
import { useTrackers } from "@/hooks/useTrackers";
import { useIssuePriorities, type IssuePriority } from "@/hooks/useIssuePriorities";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { useProjectCategories } from "@/hooks/useProjectCategories";
import { useProjectVersions } from "@/hooks/useProjectVersions";
import { createIssue, type IssueCreateInput, type IssueSummary } from "@/api/issues";

const EMPTY_VALUES: IssueFormValues = {
  subject: "",
  trackerId: null,
  priorityId: null,
  assignedToId: null,
  categoryId: null,
  fixedVersionId: null,
  startDate: "",
  dueDate: "",
  doneRatio: 0,
  estimatedHours: "",
  description: "",
};

function defaultPriorityId(priorities: IssuePriority[]): number | null {
  return priorities.find((p) => p.isDefault)?.id ?? priorities[0]?.id ?? null;
}

export interface CreateIssueDialogProps {
  trigger: ReactNode;
  client: RedmineClient | null;
  projects: Project[];
  /** Проект по умолчанию для новой задачи - например, текущий фильтр в Topbar. */
  defaultProjectId?: number | null;
  onCreated: (issue: IssueSummary) => void;
}

/**
 * Диалог создания новой задачи. Справочники трекеров/приоритетов - общие
 * (грузятся один раз), участники/категории/версии проекта - перезагружаются
 * при смене выбранного в форме проекта. См. IssueFormFields, CLAUDE.md.
 */
export function CreateIssueDialog({
  trigger,
  client,
  projects,
  defaultProjectId,
  onCreated,
}: CreateIssueDialogProps) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [values, setValues] = useState<IssueFormValues>(EMPTY_VALUES);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { trackers } = useTrackers(client);
  const { priorities } = useIssuePriorities(client);
  const { members } = useProjectMembers(client, projectId);
  const { categories } = useProjectCategories(client, projectId);
  const { versions } = useProjectVersions(client, projectId);

  const projectFieldId = useId();

  // Приоритет по умолчанию - когда справочник приоритетов подгрузился и форма еще пустая.
  useEffect(() => {
    if (open && priorities.length > 0 && values.priorityId === null) {
      setValues((v) => ({ ...v, priorityId: defaultPriorityId(priorities) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, priorities]);

  function handleOpenChange(next: boolean) {
    if (next) {
      setProjectId(defaultProjectId ?? projects[0]?.id ?? null);
      setValues(EMPTY_VALUES);
      setFormError(null);
    }
    setOpen(next);
  }

  function updateField<K extends keyof IssueFormValues>(field: K, value: IssueFormValues[K]) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!projectId) {
      setFormError("Выберите проект.");
      return;
    }
    if (!values.subject.trim()) {
      setFormError("Укажите тему задачи.");
      return;
    }

    const parsedEstimatedHours = values.estimatedHours.trim()
      ? Number(values.estimatedHours.replace(",", "."))
      : null;
    if (parsedEstimatedHours !== null && !Number.isFinite(parsedEstimatedHours)) {
      setFormError("Оценка часов должна быть числом.");
      return;
    }

    const input: IssueCreateInput = {
      projectId,
      subject: values.subject.trim(),
      trackerId: values.trackerId ?? undefined,
      priorityId: values.priorityId ?? undefined,
      description: values.description || undefined,
      assignedToId: values.assignedToId,
      categoryId: values.categoryId,
      fixedVersionId: values.fixedVersionId,
      startDate: values.startDate || undefined,
      dueDate: values.dueDate || undefined,
      doneRatio: values.doneRatio,
      estimatedHours: parsedEstimatedHours,
    };

    setIsSubmitting(true);
    try {
      const issue = await createIssue(client!, input);
      setOpen(false);
      onCreated(issue);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Не удалось создать задачу.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Новая задача</DialogTitle>
            <DialogDescription>
              Обязательны только проект и тема - остальное можно уточнить позже.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <div className="flex flex-col gap-3">
              <div>
                <Label htmlFor={projectFieldId} className="mb-1.5">
                  Проект *
                </Label>
                <Select
                  value={projectId !== null ? String(projectId) : undefined}
                  onValueChange={(v) => setProjectId(Number(v))}
                >
                  <SelectTrigger id={projectFieldId} className="w-full">
                    <SelectValue placeholder="Выберите проект" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <IssueFormFields
                values={values}
                onChange={updateField}
                trackers={trackers}
                priorities={priorities}
                members={members}
                categories={categories}
                versions={versions}
                subjectRequired
              />
            </div>
          </div>

          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
              Создать
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
