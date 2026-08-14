import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
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
import { IssuePicker } from "@/components/issues/IssuePicker";
import type { RedmineClient } from "@/api/client";
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
  /** Без trigger диалог управляется только снаружи через open/onOpenChange (см. вызов из трея в AppLayout.tsx). */
  trigger?: ReactNode;
  client: RedmineClient | null;
  projects: Project[];
  activities: TimeEntryActivity[];
  /** Проект по умолчанию для новой записи - например, текущий фильтр в Topbar. */
  defaultProjectId?: number | null;
  /** Задача по умолчанию для новой записи - например, открытая карточка задачи. */
  defaultIssueId?: number;
  /** Дата по умолчанию для новой записи (YYYY-MM-DD) - например, день с недотрекой из WeeklyTimeDebtWidget. Игнорируется в режиме правки (там дата из initial). */
  defaultSpentOn?: string;
  /** Если задано - форма открывается в режиме правки существующей записи. */
  initial?: LogTimeDialogInitial;
  onSubmit: (input: TimeEntryInput) => Promise<void>;
  /** Управляемое состояние открытия - если не передано, диалог сам открывается по клику на trigger. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  client,
  projects,
  activities,
  defaultProjectId,
  defaultIssueId,
  defaultSpentOn,
  initial,
  onSubmit,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: LogTimeDialogProps) {
  const isEditing = Boolean(initial);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;
  const [issueId, setIssueId] = useState<number | null>(null);
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
    setIssueId(initial?.issueId ?? defaultIssueId ?? null);
    setProjectId(initial?.projectId ?? defaultProjectId ?? null);
    setSpentOn(initial?.spentOn ?? defaultSpentOn ?? todayIsoDate());
    setHours(initial?.hours !== undefined ? String(initial.hours) : "");
    setActivityId(initial?.activityId ?? defaultActivityId(activities));
    setComments(initial?.comments ?? "");
    setFormError(null);
  }

  // Сброс формы при открытии - в эффекте, а не в handleOpenChange, потому
  // что при управляемом open (тревей-вызов "Залогировать время" в
  // AppLayout.tsx) Radix не зовет onOpenChange для переходов, инициированных
  // снаружи (см. тот же приём в CreateIssueDialog.tsx).
  useEffect(() => {
    if (!open) return;
    resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsedHours = Number(hours.replace(",", "."));

    if (!issueId && !projectId) {
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
        issueId: issueId ?? undefined,
        projectId: projectId ?? undefined,
        spentOn,
        hours: parsedHours,
        activityId: activityId ?? undefined,
        comments,
      });
      setOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Не удалось сохранить запись.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Изменить запись" : "Залогировать время"}
            </DialogTitle>
            <DialogDescription>
              Укажите задачу (или проект, если задачи под рукой нет), сколько
              потрачено времени и на что.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={issueFieldId} className="mb-1.5">
                Задача
              </Label>
              <IssuePicker
                client={client}
                value={issueId}
                onChange={setIssueId}
                projectId={projectId}
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
                // min=0, не 0.01: у <input type=number step=0.25> браузер
                // считает допустимыми только min + n*step - с min=0.01 это
                // 0.01, 0.26, 0.51, ... 4.76, 5.01, ... т.е. почти ни одно
                // круглое число (5, 8...) не проходит нативную HTML-валидацию
                // (submit тихо блокируется, form.requestSubmit() показывает
                // "nearest valid values are 4.76 and 5.01") - найдено на
                // практике при проверке WeeklyTimeDebtWidget. Ноль/отрицательные
                // отсекает JS-проверка ниже (parsedHours <= 0), min тут только
                // подсказка браузерному спиннеру, не источник правды.
                min={0}
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
