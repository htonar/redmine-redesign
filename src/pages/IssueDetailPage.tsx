import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Loader2, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LogTimeDialog } from "@/components/time/LogTimeDialog";
import { IssueFormFields, type IssueFormValues } from "@/components/issues/IssueFormFields";
import { useAuth } from "@/contexts/AuthContext";
import { useIssue } from "@/hooks/useIssue";
import { useProjects } from "@/hooks/useProjects";
import { useTimeEntryActivities } from "@/hooks/useTimeEntryActivities";
import { useTrackers } from "@/hooks/useTrackers";
import { useIssuePriorities } from "@/hooks/useIssuePriorities";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { useProjectCategories } from "@/hooks/useProjectCategories";
import { useProjectVersions } from "@/hooks/useProjectVersions";
import { updateIssue, type Issue, type IssueUpdateInput } from "@/api/issues";
import { createTimeEntry, type TimeEntryInput } from "@/api/timeEntries";

/** Человекочитаемые подписи для самых частых полей в истории изменений (journal.details). */
const FIELD_LABELS: Record<string, string> = {
  status_id: "Статус",
  assigned_to_id: "Исполнитель",
  priority_id: "Приоритет",
  subject: "Тема",
  description: "Описание",
  done_ratio: "Готовность",
  fixed_version_id: "Версия",
  category_id: "Категория",
  start_date: "Дата начала",
  due_date: "Срок",
  estimated_hours: "Оценка часов",
  tracker_id: "Трекер",
  project_id: "Проект",
  is_private: "Приватность",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface FieldProps {
  label: string;
  children: ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function issueToFormValues(issue: Issue): IssueFormValues {
  return {
    subject: issue.subject,
    trackerId: issue.tracker?.id ?? null,
    priorityId: issue.priority?.id ?? null,
    assignedToId: issue.assigned_to?.id ?? null,
    categoryId: issue.category?.id ?? null,
    fixedVersionId: issue.fixed_version?.id ?? null,
    startDate: issue.start_date ?? "",
    dueDate: issue.due_date ?? "",
    doneRatio: issue.done_ratio ?? 0,
    estimatedHours: issue.estimated_hours != null ? String(issue.estimated_hours) : "",
    description: issue.description ?? "",
  };
}

/** Патч только из полей, реально изменённых в форме - остальные не отправляем. */
function diffFormValues(initial: IssueFormValues, current: IssueFormValues): IssueUpdateInput {
  const patch: IssueUpdateInput = {};
  if (current.subject !== initial.subject) patch.subject = current.subject;
  if (current.trackerId !== initial.trackerId && current.trackerId !== null) {
    patch.trackerId = current.trackerId;
  }
  if (current.priorityId !== initial.priorityId && current.priorityId !== null) {
    patch.priorityId = current.priorityId;
  }
  if (current.assignedToId !== initial.assignedToId) patch.assignedToId = current.assignedToId;
  if (current.categoryId !== initial.categoryId) patch.categoryId = current.categoryId;
  if (current.fixedVersionId !== initial.fixedVersionId) {
    patch.fixedVersionId = current.fixedVersionId;
  }
  if (current.startDate !== initial.startDate) patch.startDate = current.startDate || null;
  if (current.dueDate !== initial.dueDate) patch.dueDate = current.dueDate || null;
  if (current.doneRatio !== initial.doneRatio) patch.doneRatio = current.doneRatio;
  if (current.estimatedHours !== initial.estimatedHours) {
    const trimmed = current.estimatedHours.trim();
    patch.estimatedHours = trimmed ? Number(trimmed.replace(",", ".")) : null;
  }
  if (current.description !== initial.description) {
    patch.description = current.description || null;
  }
  return patch;
}

function JournalEntry({ journal }: { journal: NonNullable<Issue["journals"]>[number] }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{journal.user?.name ?? "Кто-то"}</span>
        {formatDateTime(journal.created_on)}
      </div>
      {journal.notes && <p className="text-sm whitespace-pre-wrap">{journal.notes}</p>}
      {journal.details.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {journal.details.map((d, i) => (
            <li key={i}>
              {FIELD_LABELS[d.name] ?? d.name}: {d.old_value ?? "—"} → {d.new_value ?? "—"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Карточка задачи: метаданные, смена статуса (из allowed_statuses - соблюдает
 * workflow текущего пользователя), описание, история/комментарии, быстрое
 * логирование времени. Режим правки (кнопка "Редактировать") переключает блок
 * метаданных+описания на IssueFormFields - тема, трекер, приоритет,
 * исполнитель, категория, версия, даты, готовность, оценка часов, описание.
 * Проект задачи не меняется (нет селектора). Смена статуса остается отдельным
 * мгновенным контролом в шапке, вне формы правки - см. CLAUDE.md.
 */
export function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { client } = useAuth();
  const { projects } = useProjects(client);
  const { activities } = useTimeEntryActivities(client);
  const issueId = id ? Number(id) : null;
  const { issue, isLoading, error, reload } = useIssue(client, issueId);
  const projectId = issue?.project?.id ?? null;
  const { trackers } = useTrackers(client);
  const { priorities } = useIssuePriorities(client);
  const { members } = useProjectMembers(client, projectId);
  const { categories } = useProjectCategories(client, projectId);
  const { versions } = useProjectVersions(client, projectId);

  const [comment, setComment] = useState("");
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<IssueFormValues | null>(null);
  const [editInitialValues, setEditInitialValues] = useState<IssueFormValues | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function handleStartEdit() {
    if (!issue) return;
    const values = issueToFormValues(issue);
    setEditValues(values);
    setEditInitialValues(values);
    setEditError(null);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditValues(null);
    setEditInitialValues(null);
    setEditError(null);
  }

  function updateEditField<K extends keyof IssueFormValues>(field: K, value: IssueFormValues[K]) {
    setEditValues((v) => (v ? { ...v, [field]: value } : v));
  }

  async function handleSaveEdit() {
    if (!client || !issue || !editValues || !editInitialValues) return;
    setEditError(null);

    if (!editValues.subject.trim()) {
      setEditError("Укажите тему задачи.");
      return;
    }
    const trimmedHours = editValues.estimatedHours.trim();
    if (trimmedHours && !Number.isFinite(Number(trimmedHours.replace(",", ".")))) {
      setEditError("Оценка часов должна быть числом.");
      return;
    }

    const patch = diffFormValues(editInitialValues, editValues);
    if (Object.keys(patch).length === 0) {
      setIsEditing(false);
      return;
    }

    setIsSavingEdit(true);
    try {
      await updateIssue(client, issue.id, patch);
      setIsEditing(false);
      setEditValues(null);
      setEditInitialValues(null);
      reload();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Не удалось сохранить изменения.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleStatusChange(statusId: string) {
    if (!client || !issue) return;
    setIsSavingStatus(true);
    setActionError(null);
    try {
      await updateIssue(client, issue.id, { statusId: Number(statusId) });
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Не удалось изменить статус.");
    } finally {
      setIsSavingStatus(false);
    }
  }

  async function handleAddComment() {
    if (!client || !issue || !comment.trim()) return;
    setIsSavingComment(true);
    setActionError(null);
    try {
      await updateIssue(client, issue.id, { notes: comment });
      setComment("");
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Не удалось добавить комментарий.");
    } finally {
      setIsSavingComment(false);
    }
  }

  async function handleLogTime(input: TimeEntryInput) {
    if (!client) return;
    await createTimeEntry(client, input);
    reload();
  }

  if (!issueId || Number.isNaN(issueId)) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Некорректный номер задачи.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="w-fit gap-1.5" onClick={() => navigate("/issues")}>
        <ArrowLeft className="size-3.5" />
        К списку задач
      </Button>

      {(error || actionError) && (
        <Alert variant="destructive">
          <AlertDescription>{error ?? actionError}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Загрузка...
        </div>
      )}

      {!isLoading && issue && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs text-muted-foreground">
                {issue.tracker?.name ?? "Задача"} #{issue.id}
              </div>
              <h1 className="text-xl font-semibold tracking-tight">{issue.subject}</h1>
            </div>
            <div className="flex items-center gap-2">
              {!isEditing && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleStartEdit}>
                  <Pencil className="size-3.5" />
                  Редактировать
                </Button>
              )}
              {issue.priority?.name && <Badge variant="outline">{issue.priority.name}</Badge>}
              {issue.allowed_statuses && issue.allowed_statuses.length > 0 ? (
                <Select
                  value={String(issue.status?.id ?? "")}
                  onValueChange={handleStatusChange}
                  disabled={isSavingStatus}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Статус" />
                  </SelectTrigger>
                  <SelectContent>
                    {issue.allowed_statuses.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                issue.status && (
                  <Badge variant={issue.status.is_closed ? "secondary" : "default"}>
                    {issue.status.name}
                  </Badge>
                )
              )}
            </div>
          </div>

          {isEditing && editValues ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Правка задачи</CardTitle>
              </CardHeader>
              <CardContent>
                <IssueFormFields
                  values={editValues}
                  onChange={updateEditField}
                  trackers={trackers}
                  priorities={priorities}
                  members={members}
                  categories={categories}
                  versions={versions}
                  subjectRequired
                />

                {editError && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertDescription>{editError}</AlertDescription>
                  </Alert>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <Button size="sm" onClick={handleSaveEdit} disabled={isSavingEdit}>
                    {isSavingEdit && <Loader2 className="size-3.5 animate-spin" />}
                    Сохранить
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    disabled={isSavingEdit}
                  >
                    Отмена
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  <Field label="Проект">
                    {issue.project ? (
                      <Link to="/issues" className="hover:underline">
                        {issue.project.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Field>
                  <Field label="Автор">{issue.author?.name ?? "—"}</Field>
                  <Field label="Исполнитель">{issue.assigned_to?.name ?? "—"}</Field>
                  <Field label="Категория">{issue.category?.name ?? "—"}</Field>
                  <Field label="Версия">{issue.fixed_version?.name ?? "—"}</Field>
                  <Field label="Начало">
                    {issue.start_date ? formatDate(issue.start_date) : "—"}
                  </Field>
                  <Field label="Срок">{issue.due_date ? formatDate(issue.due_date) : "—"}</Field>
                  <Field label="Обновлено">{formatDateTime(issue.updated_on)}</Field>
                  <Field label="Оценка">
                    {issue.estimated_hours != null ? `${issue.estimated_hours} ч` : "—"}
                  </Field>
                  <Field label="Потрачено">
                    {issue.spent_hours != null ? `${issue.spent_hours.toFixed(2)} ч` : "—"}
                  </Field>
                  <div className="col-span-2 sm:col-span-3 lg:col-span-4">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Готовность</span>
                      <span>{issue.done_ratio}%</span>
                    </div>
                    <Progress value={issue.done_ratio} />
                  </div>
                </CardContent>
              </Card>

              {issue.description && (
                <Card>
                  <CardHeader className="border-b">
                    <CardTitle>Описание</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{issue.description}</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <Card>
            <CardHeader className="flex items-center justify-between border-b">
              <CardTitle>Время</CardTitle>
              <LogTimeDialog
                projects={projects}
                activities={activities}
                defaultProjectId={issue.project?.id}
                defaultIssueId={issue.id}
                onSubmit={handleLogTime}
                trigger={
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Plus className="size-3.5" />
                    Залогировать время
                  </Button>
                }
              />
            </CardHeader>
            <CardContent>
              <span className="text-sm text-muted-foreground">
                Потрачено всего: {issue.spent_hours != null ? `${issue.spent_hours.toFixed(2)} ч` : "0 ч"}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>История и комментарии</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col">
                {issue.journals && issue.journals.length > 0 ? (
                  issue.journals.map((j) => <JournalEntry key={j.id} journal={j} />)
                ) : (
                  <p className="py-2 text-sm text-muted-foreground">Пока пусто</p>
                )}
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <Textarea
                  placeholder="Добавить комментарий..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <Button
                  size="sm"
                  className="w-fit"
                  disabled={!comment.trim() || isSavingComment}
                  onClick={handleAddComment}
                >
                  {isSavingComment && <Loader2 className="size-3.5 animate-spin" />}
                  Добавить
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
