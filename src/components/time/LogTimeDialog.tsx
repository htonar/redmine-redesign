import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { Project } from "@/hooks/useProjects";
import type { TimeEntryActivity } from "@/hooks/useTimeEntryActivities";
import type { TimeEntryInput } from "@/api/timeEntries";

export interface LogTimeDialogInitial {
  issueId?: number;
  projectId?: number;
  spentOn: string;
  hours: number;
  activityId?: number;
  comments: string;
}

export interface LogTimeDialogProps {
  trigger: ReactNode;
  projects: Project[];
  activities: TimeEntryActivity[];
  /** Проект по умолчанию для новой записи - например, текущий фильтр в Topbar. */
  defaultProjectId?: number | null;
  /** Задача по умолчанию для новой записи - например, открытая карточка задачи. */
  defaultIssueId?: number;
  /** Если задано - форма открывается в режиме правки существующей записи. */
  initial?: LogTimeDialogInitial;
  onSubmit: (input: TimeEntryInput) => Promise<void>;
}

function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function defaultActivityId(activities: TimeEntryActivity[]): number | null {
  return activities.find((a) => a.isDefault)?.id ?? activities[0]?.id ?? null;
}

/**
 * Диалог создания или правки записи учета времени - используется и для
 * "быстрого ввода" (кнопка на странице учета времени), и для редактирования
 * существующей записи. См. CLAUDE.md, раздел "Учет трудозатрат".
 */
export function LogTimeDialog({
  trigger,
  projects,
  activities,
  defaultProjectId,
  defaultIssueId,
  initial,
  onSubmit,
}: LogTimeDialogProps) {
  const isEditing = Boolean(initial);
  const [open, setOpen] = useState(false);
  const [issueId, setIssueId] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [spentOn, setSpentOn] = useState(todayIsoDate());
  const [hours, setHours] = useState("");
  const [activityId, setActivityId] = useState<number | null>(null);
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const issueFieldId = useId();
  const projectFieldId = useId();
  const dateFieldId = useId();
  const hoursFieldId = useId();
  const activityFieldId = useId();
  const commentsFieldId = useId();

  function resetForm() {
    setIssueId(
      initial?.issueId ? String(initial.issueId) : defaultIssueId ? String(defaultIssueId) : "",
    );
    setProjectId(initial?.projectId ?? defaultProjectId ?? null);
    setSpentOn(initial?.spentOn ?? todayIsoDate());
    setHours(initial?.hours !== undefined ? String(initial.hours) : "");
    setActivityId(initial?.activityId ?? defaultActivityId(activities));
    setComments(initial?.comments ?? "");
    setFormError(null);
  }

  function handleOpenChange(next: boolean) {
    if (next) resetForm();
    setOpen(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const trimmedIssueId = issueId.trim();
    const parsedIssueId = trimmedIssueId ? Number(trimmedIssueId) : undefined;
    const parsedHours = Number(hours.replace(",", "."));

    if (!parsedIssueId && !projectId) {
      setFormError("Укажите задачу или проект.");
      return;
    }
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      setFormError("Часы должны быть положительным числом.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        issueId: parsedIssueId,
        projectId: projectId ?? undefined,
        spentOn,
        hours: parsedHours,
        activityId: activityId ?? undefined,
        comments,
      });
      setOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Не удалось сохранить запись.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Изменить запись" : "Залогировать время"}</DialogTitle>
            <DialogDescription>
              Укажите задачу (или проект, если задачи под рукой нет), сколько потрачено
              времени и на что.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={issueFieldId} className="mb-1.5">
                № задачи
              </Label>
              <Input
                id={issueFieldId}
                type="number"
                min={1}
                placeholder="например, 1234"
                value={issueId}
                onChange={(e) => setIssueId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={projectFieldId} className="mb-1.5">
                Проект
              </Label>
              <Select
                value={projectId !== null ? String(projectId) : undefined}
                onValueChange={(v) => setProjectId(Number(v))}
              >
                <SelectTrigger id={projectFieldId} className="w-full">
                  <SelectValue placeholder="Не выбран" />
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={dateFieldId} className="mb-1.5">
                Дата
              </Label>
              <Input
                id={dateFieldId}
                type="date"
                value={spentOn}
                onChange={(e) => setSpentOn(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={hoursFieldId} className="mb-1.5">
                Часы
              </Label>
              <Input
                id={hoursFieldId}
                type="number"
                min={0.01}
                step={0.25}
                placeholder="например, 1.5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor={activityFieldId} className="mb-1.5">
              Вид деятельности
            </Label>
            <Select
              value={activityId !== null ? String(activityId) : undefined}
              onValueChange={(v) => setActivityId(Number(v))}
            >
              <SelectTrigger id={activityFieldId} className="w-full">
                <SelectValue placeholder="Не выбран" />
              </SelectTrigger>
              <SelectContent>
                {activities.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor={commentsFieldId} className="mb-1.5">
              Комментарий
            </Label>
            <Input
              id={commentsFieldId}
              placeholder="Необязательно"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>

          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
              {isEditing ? "Сохранить" : "Залогировать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
