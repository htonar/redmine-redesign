import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LogTimeDialog } from "@/components/time/LogTimeDialog";
import {
  IssueFormFields,
  type IssueFormValues,
} from "@/components/issues/IssueFormFields";
import { useAuth } from "@/contexts/AuthContext";
import { useIssue } from "@/hooks/useIssue";
import { useIssueSummaries } from "@/hooks/useIssueSummaries";
import { useProjects } from "@/hooks/useProjects";
import { useTimeEntryActivities } from "@/hooks/useTimeEntryActivities";
import { useTrackers } from "@/hooks/useTrackers";
import { useIssuePriorities } from "@/hooks/useIssuePriorities";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { useProjectCategories } from "@/hooks/useProjectCategories";
import { useProjectVersions } from "@/hooks/useProjectVersions";
import { useCustomFieldDefinitions } from "@/hooks/useCustomFieldDefinitions";
import type { CustomFieldDefinition } from "@/api/customFields";
import {
  createIssueRelation,
  deleteIssue,
  deleteIssueRelation,
  updateIssue,
  type Issue,
  type IssueRelationType,
  type IssueUpdateInput,
} from "@/api/issues";
import { createTimeEntry, type TimeEntryInput } from "@/api/timeEntries";
import {
  deleteAttachment,
  downloadAttachment,
  uploadAttachment,
  type Attachment,
} from "@/api/attachments";
import { addWatcher, removeWatcher } from "@/api/watchers";
import { JournalEntry } from "@/components/issues/JournalEntry";
import {
  RELATION_TYPE_INVERSE,
  RELATION_TYPE_LABELS,
  RELATION_TYPE_OPTIONS,
} from "@/lib/issue-relations";
import { formatDateTime } from "@/lib/journal-format";
import { formatFileSize } from "@/lib/utils";
import { celebrate } from "@/lib/celebrate";

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

/**
 * `definitions` - справочник GET /custom_fields.json (только для админов,
 * см. useCustomFieldDefinitions) - без него поля всё равно показываются и
 * редактируются (значения уже есть на самом issue), просто обычным текстом
 * вместо типового инпута (select для list/bool и т.п.), см. CLAUDE.md.
 */
function issueToFormValues(
  issue: Issue,
  definitions: CustomFieldDefinition[],
): IssueFormValues {
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
    estimatedHours:
      issue.estimated_hours != null ? String(issue.estimated_hours) : "",
    description: issue.description ?? "",
    customFields: (issue.custom_fields ?? []).map((f) => {
      const def = definitions.find((d) => d.id === f.id);
      return {
        id: f.id,
        name: f.name,
        value: f.value ?? (f.multiple ? [] : ""),
        fieldFormat: def?.field_format,
        possibleValues: def?.possible_values,
        multiple: f.multiple,
      };
    }),
  };
}

/** Патч только из полей, реально изменённых в форме - остальные не отправляем. */
function diffFormValues(
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
  const { client, can, user } = useAuth();
  const { projects } = useProjects(client);
  const { activities } = useTimeEntryActivities(client);
  const issueId = id ? Number(id) : null;
  const { issue, isLoading, error, reload } = useIssue(client, issueId);
  const projectId = issue?.project?.id ?? null;
  const { trackers } = useTrackers(client);
  const { priorities } = useIssuePriorities(client);
  const { members } = useProjectMembers(client, projectId, user);
  const { categories } = useProjectCategories(client, projectId);
  const { versions } = useProjectVersions(client, projectId);
  const { definitions: customFieldDefinitions } =
    useCustomFieldDefinitions(client);
  // Для истории изменений (JournalEntry) - записи об изменении custom field
  // приходят как {property: "cf", name: "<id>"}, без имени - см. JournalEntry.
  // issue.custom_fields не требует прав администратора (в отличие от
  // customFieldDefinitions) - основной источник; definitions лишь дополняют
  // именами полей, которых на этой задаче сейчас нет (могли быть в старой
  // записи истории, но позже сняты с трекера).
  const customFieldNames = useMemo(() => {
    const fromDefinitions = customFieldDefinitions.map(
      (d): [number, string] => [d.id, d.name],
    );
    const fromIssue = (issue?.custom_fields ?? []).map(
      (f): [number, string] => [f.id, f.name],
    );
    return Object.fromEntries([...fromDefinitions, ...fromIssue]);
  }, [customFieldDefinitions, issue?.custom_fields]);

  // Родитель и "другая сторона" каждой связи отдают только { id } - подгружаем
  // темы отдельно, см. useIssueSummaries.
  const relationOtherIds = (issue?.relations ?? [])
    .map((r) => (r.issue_id === issue?.id ? r.issue_to_id : r.issue_id))
    .filter((v): v is number => v != null);
  const summaryIds = [
    ...(issue?.parent?.id ? [issue.parent.id] : []),
    ...relationOtherIds,
  ];
  const relatedSummaries = useIssueSummaries(client, summaryIds);

  const [comment, setComment] = useState("");
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<IssueFormValues | null>(null);
  const [editInitialValues, setEditInitialValues] =
    useState<IssueFormValues | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [parentInput, setParentInput] = useState("");
  const [isEditingParent, setIsEditingParent] = useState(false);
  const [isSavingParent, setIsSavingParent] = useState(false);
  const [parentError, setParentError] = useState<string | null>(null);

  const [childInput, setChildInput] = useState("");
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [childError, setChildError] = useState<string | null>(null);

  const [relationInput, setRelationInput] = useState("");
  const [relationType, setRelationType] =
    useState<IssueRelationType>("relates");
  const [isAddingRelation, setIsAddingRelation] = useState(false);
  const [relationError, setRelationError] = useState<string | null>(null);
  const [removingRelationId, setRemovingRelationId] = useState<number | null>(
    null,
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<
    number | null
  >(null);
  const [removingAttachmentId, setRemovingAttachmentId] = useState<
    number | null
  >(null);

  const [watcherInput, setWatcherInput] = useState("");
  const [isAddingWatcher, setIsAddingWatcher] = useState(false);
  const [watcherError, setWatcherError] = useState<string | null>(null);
  const [removingWatcherId, setRemovingWatcherId] = useState<number | null>(
    null,
  );
  const [isTogglingSelfWatch, setIsTogglingSelfWatch] = useState(false);

  function handleStartEdit() {
    if (!issue) return;
    const values = issueToFormValues(issue, customFieldDefinitions);
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

  // Хоткей "e" - редактировать открытую задачу (см. CLAUDE.md, "Горячие
  // клавиши"). Игнорируем, пока фокус в поле ввода/открыт диалог - иначе
  // перехватывалась бы обычная буква "e" при наборе текста.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() !== "e") return;
      const target = e.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      if (document.querySelector('[data-slot="dialog-content"]')) return;
      if (!issue || isEditing || !can("edit_issues", projectId)) return;
      e.preventDefault();
      handleStartEdit();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue, isEditing, projectId]);

  function updateEditField<K extends keyof IssueFormValues>(
    field: K,
    value: IssueFormValues[K],
  ) {
    setEditValues((v) => (v ? { ...v, [field]: value } : v));
  }

  async function handleSetParent() {
    if (!client || !issue) return;
    const parentId = Number(parentInput.trim());
    if (!parentInput.trim() || !Number.isFinite(parentId)) {
      setParentError("Укажите номер задачи.");
      return;
    }
    if (parentId === issue.id) {
      setParentError("Задача не может быть родителем сама себе.");
      return;
    }
    setParentError(null);
    setIsSavingParent(true);
    try {
      await updateIssue(client, issue.id, { parentId });
      setIsEditingParent(false);
      setParentInput("");
      reload();
    } catch (e) {
      setParentError(
        e instanceof Error
          ? e.message
          : "Не удалось указать родительскую задачу.",
      );
    } finally {
      setIsSavingParent(false);
    }
  }

  async function handleClearParent() {
    if (!client || !issue) return;
    setParentError(null);
    setIsSavingParent(true);
    try {
      await updateIssue(client, issue.id, { parentId: null });
      reload();
    } catch (e) {
      setParentError(
        e instanceof Error
          ? e.message
          : "Не удалось убрать родительскую задачу.",
      );
    } finally {
      setIsSavingParent(false);
    }
  }

  async function handleAddChild() {
    if (!client || !issue) return;
    const childId = Number(childInput.trim());
    if (!childInput.trim() || !Number.isFinite(childId)) {
      setChildError("Укажите номер задачи.");
      return;
    }
    if (childId === issue.id) {
      setChildError("Задача не может быть подзадачей сама себе.");
      return;
    }
    setChildError(null);
    setIsAddingChild(true);
    try {
      await updateIssue(client, childId, { parentId: issue.id });
      setChildInput("");
      reload();
    } catch (e) {
      setChildError(
        e instanceof Error ? e.message : "Не удалось добавить подзадачу.",
      );
    } finally {
      setIsAddingChild(false);
    }
  }

  async function handleAddRelation() {
    if (!client || !issue) return;
    const issueToId = Number(relationInput.trim());
    if (!relationInput.trim() || !Number.isFinite(issueToId)) {
      setRelationError("Укажите номер задачи.");
      return;
    }
    if (issueToId === issue.id) {
      setRelationError("Задача не может быть связана сама с собой.");
      return;
    }
    setRelationError(null);
    setIsAddingRelation(true);
    try {
      await createIssueRelation(client, issue.id, { issueToId, relationType });
      setRelationInput("");
      reload();
    } catch (e) {
      setRelationError(
        e instanceof Error ? e.message : "Не удалось добавить связь.",
      );
    } finally {
      setIsAddingRelation(false);
    }
  }

  async function handleRemoveRelation(relationId: number) {
    if (!client) return;
    setRelationError(null);
    setRemovingRelationId(relationId);
    try {
      await deleteIssueRelation(client, relationId);
      reload();
    } catch (e) {
      setRelationError(
        e instanceof Error ? e.message : "Не удалось удалить связь.",
      );
    } finally {
      setRemovingRelationId(null);
    }
  }

  async function handleUploadFile(file: File) {
    if (!client || !issue) return;
    setAttachmentError(null);
    setIsUploadingFile(true);
    try {
      const uploaded = await uploadAttachment(client, file);
      await updateIssue(client, issue.id, { uploads: [uploaded] });
      reload();
    } catch (e) {
      setAttachmentError(
        e instanceof Error ? e.message : "Не удалось загрузить файл.",
      );
    } finally {
      setIsUploadingFile(false);
    }
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Сбрасываем value - иначе повторный выбор того же файла не вызовет onChange.
    e.target.value = "";
    if (file) void handleUploadFile(file);
  }

  async function handleDownloadAttachment(attachment: Attachment) {
    if (!client) return;
    setAttachmentError(null);
    setDownloadingAttachmentId(attachment.id);
    try {
      await downloadAttachment(client, attachment);
    } catch (e) {
      setAttachmentError(
        e instanceof Error ? e.message : "Не удалось скачать файл.",
      );
    } finally {
      setDownloadingAttachmentId(null);
    }
  }

  async function handleRemoveAttachment(attachmentId: number) {
    if (!client) return;
    setAttachmentError(null);
    setRemovingAttachmentId(attachmentId);
    try {
      await deleteAttachment(client, attachmentId);
      reload();
    } catch (e) {
      setAttachmentError(
        e instanceof Error ? e.message : "Не удалось удалить файл.",
      );
    } finally {
      setRemovingAttachmentId(null);
    }
  }

  async function handleAddWatcher(userId: number) {
    if (!client || !issue) return;
    setWatcherError(null);
    setIsAddingWatcher(true);
    try {
      await addWatcher(client, issue.id, userId);
      setWatcherInput("");
      reload();
    } catch (e) {
      setWatcherError(
        e instanceof Error ? e.message : "Не удалось добавить наблюдателя.",
      );
    } finally {
      setIsAddingWatcher(false);
    }
  }

  async function handleRemoveWatcher(userId: number) {
    if (!client || !issue) return;
    setWatcherError(null);
    setRemovingWatcherId(userId);
    try {
      await removeWatcher(client, issue.id, userId);
      reload();
    } catch (e) {
      setWatcherError(
        e instanceof Error ? e.message : "Не удалось убрать наблюдателя.",
      );
    } finally {
      setRemovingWatcherId(null);
    }
  }

  async function handleToggleSelfWatch(isWatching: boolean) {
    if (!client || !issue || !user) return;
    setWatcherError(null);
    setIsTogglingSelfWatch(true);
    try {
      if (isWatching) {
        await removeWatcher(client, issue.id, user.id);
      } else {
        await addWatcher(client, issue.id, user.id);
      }
      reload();
    } catch (e) {
      setWatcherError(
        e instanceof Error ? e.message : "Не удалось изменить подписку.",
      );
    } finally {
      setIsTogglingSelfWatch(false);
    }
  }

  async function handleSaveEdit() {
    if (!client || !issue || !editValues || !editInitialValues) return;
    setEditError(null);

    if (!editValues.subject.trim()) {
      setEditError("Укажите тему задачи.");
      return;
    }
    const trimmedHours = editValues.estimatedHours.trim();
    if (
      trimmedHours &&
      !Number.isFinite(Number(trimmedHours.replace(",", ".")))
    ) {
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
      // Мягкая геймификация - confetti при выходе на 100% готовности через
      // форму правки (независимо от смены статуса выше). См. lib/celebrate.ts.
      if (patch.doneRatio === 100 && editInitialValues.doneRatio !== 100) {
        celebrate();
      }
      setIsEditing(false);
      setEditValues(null);
      setEditInitialValues(null);
      reload();
    } catch (e) {
      setEditError(
        e instanceof Error ? e.message : "Не удалось сохранить изменения.",
      );
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDelete() {
    if (!client || !issue) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await deleteIssue(client, issue.id);
      navigate("/issues");
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Не удалось удалить задачу.",
      );
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  }

  async function handleStatusChange(statusId: string) {
    if (!client || !issue) return;
    setIsSavingStatus(true);
    setActionError(null);
    try {
      await updateIssue(client, issue.id, { statusId: Number(statusId) });
      // Мягкая геймификация - confetti при закрытии задачи (переход в статус
      // is_closed, не при каждой смене статуса). См. lib/celebrate.ts.
      const targetIsClosed = issue.allowed_statuses?.find(
        (s) => s.id === Number(statusId),
      )?.is_closed;
      if (targetIsClosed && !issue.status?.is_closed) celebrate();
      reload();
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Не удалось изменить статус.",
      );
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
      setActionError(
        e instanceof Error ? e.message : "Не удалось добавить комментарий.",
      );
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
      <Button
        variant="ghost"
        size="sm"
        className="w-fit gap-1.5"
        onClick={() => navigate("/issues")}
      >
        <ArrowLeft className="size-3.5" />К списку задач
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
              <h1 className="text-xl font-semibold tracking-tight">
                {issue.subject}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {!isEditing && can("edit_issues", projectId) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleStartEdit}
                >
                  <Pencil className="size-3.5" />
                  Редактировать
                </Button>
              )}
              {can("delete_issues", projectId) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  Удалить
                </Button>
              )}
              {issue.priority?.name && (
                <Badge variant="outline">{issue.priority.name}</Badge>
              )}
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
                  <Badge
                    variant={issue.status.is_closed ? "secondary" : "default"}
                  >
                    {issue.status.name}
                  </Badge>
                )
              )}
            </div>
          </div>

          <ConfirmDialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            title={`Удалить задачу #${issue.id}?`}
            description={`«${issue.subject}» будет удалена без возможности восстановления.`}
            onConfirm={handleDelete}
            isConfirming={isDeleting}
          />

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
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit}
                  >
                    {isSavingEdit && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
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
                  <Field label="Исполнитель">
                    {issue.assigned_to?.name ?? "—"}
                  </Field>
                  <Field label="Категория">{issue.category?.name ?? "—"}</Field>
                  <Field label="Версия">
                    {issue.fixed_version?.name ?? "—"}
                  </Field>
                  <Field label="Начало">
                    {issue.start_date ? formatDate(issue.start_date) : "—"}
                  </Field>
                  <Field label="Срок">
                    {issue.due_date ? formatDate(issue.due_date) : "—"}
                  </Field>
                  <Field label="Обновлено">
                    {formatDateTime(issue.updated_on)}
                  </Field>
                  <Field label="Оценка">
                    {issue.estimated_hours != null
                      ? `${issue.estimated_hours} ч`
                      : "—"}
                  </Field>
                  <Field label="Потрачено">
                    {issue.spent_hours != null
                      ? `${issue.spent_hours.toFixed(2)} ч`
                      : "—"}
                  </Field>
                  {(issue.custom_fields ?? []).map((f) => (
                    <Field key={f.id} label={f.name}>
                      {Array.isArray(f.value)
                        ? f.value.filter(Boolean).join(", ") || "—"
                        : (f.value ?? "—")}
                    </Field>
                  ))}
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
                    <p className="text-sm whitespace-pre-wrap">
                      {issue.description}
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Подзадачи и связи</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div>
                <div className="mb-1.5 text-xs text-muted-foreground">
                  Родительская задача
                </div>
                {issue.parent?.id ? (
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/issues/${issue.parent.id}`}
                      className="text-sm hover:underline"
                    >
                      #{issue.parent.id} —{" "}
                      {relatedSummaries[issue.parent.id]?.subject ?? "..."}
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-muted-foreground hover:text-destructive"
                      onClick={handleClearParent}
                      disabled={isSavingParent}
                      aria-label="Убрать родительскую задачу"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : isEditingParent ? (
                  <div className="flex items-center gap-2">
                    <Input
                      className="w-28"
                      placeholder="№ задачи"
                      value={parentInput}
                      onChange={(e) => setParentInput(e.target.value)}
                    />
                    <Button
                      size="sm"
                      onClick={handleSetParent}
                      disabled={isSavingParent}
                    >
                      {isSavingParent && (
                        <Loader2 className="size-3.5 animate-spin" />
                      )}
                      Указать
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsEditingParent(false);
                        setParentInput("");
                        setParentError(null);
                      }}
                      disabled={isSavingParent}
                    >
                      Отмена
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setIsEditingParent(true)}
                  >
                    <Plus className="size-3.5" />
                    Указать родителя
                  </Button>
                )}
                {parentError && (
                  <p className="mt-1 text-xs text-destructive">{parentError}</p>
                )}
              </div>

              <div>
                <div className="mb-1.5 text-xs text-muted-foreground">
                  Подзадачи
                </div>
                {issue.children && issue.children.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {issue.children.map((c, i) => (
                      <li key={c.id ?? i}>
                        <Link
                          to={`/issues/${c.id}`}
                          className="text-sm hover:underline"
                        >
                          #{c.id} — {c.subject ?? "—"}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Нет</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    className="w-28"
                    placeholder="№ задачи"
                    value={childInput}
                    onChange={(e) => setChildInput(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={handleAddChild}
                    disabled={isAddingChild}
                  >
                    {isAddingChild && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    <Plus className="size-3.5" />
                    Добавить подзадачу
                  </Button>
                </div>
                {childError && (
                  <p className="mt-1 text-xs text-destructive">{childError}</p>
                )}
              </div>

              <div>
                <div className="mb-1.5 text-xs text-muted-foreground">
                  Связанные задачи
                </div>
                {issue.relations && issue.relations.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {issue.relations.map((r, i) => {
                      const type = r.relation_type ?? "relates";
                      const isForward = r.issue_id === issue.id;
                      const otherId = isForward ? r.issue_to_id : r.issue_id;
                      const label = isForward
                        ? RELATION_TYPE_LABELS[type]
                        : RELATION_TYPE_LABELS[RELATION_TYPE_INVERSE[type]];
                      const otherSummary =
                        otherId != null ? relatedSummaries[otherId] : undefined;
                      return (
                        <li
                          key={r.id ?? i}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="text-sm">
                            <span className="text-muted-foreground">
                              {label}:
                            </span>{" "}
                            {otherId != null ? (
                              <Link
                                to={`/issues/${otherId}`}
                                className="hover:underline"
                              >
                                #{otherId} — {otherSummary?.subject ?? "..."}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              r.id != null && handleRemoveRelation(r.id)
                            }
                            disabled={
                              r.id == null || removingRelationId === r.id
                            }
                            aria-label="Удалить связь"
                          >
                            {removingRelationId === r.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <X className="size-3.5" />
                            )}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Нет</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Select
                    value={relationType}
                    onValueChange={(v) =>
                      setRelationType(v as IssueRelationType)
                    }
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATION_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="w-28"
                    placeholder="№ задачи"
                    value={relationInput}
                    onChange={(e) => setRelationInput(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={handleAddRelation}
                    disabled={isAddingRelation}
                  >
                    {isAddingRelation && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    <Plus className="size-3.5" />
                    Добавить связь
                  </Button>
                </div>
                {relationError && (
                  <p className="mt-1 text-xs text-destructive">
                    {relationError}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Вложения</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {issue.attachments && issue.attachments.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {issue.attachments.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 items-center gap-1.5 text-left hover:underline disabled:opacity-50"
                        onClick={() => handleDownloadAttachment(a)}
                        disabled={downloadingAttachmentId === a.id}
                      >
                        {downloadingAttachmentId === a.id ? (
                          <Loader2 className="size-3.5 shrink-0 animate-spin" />
                        ) : (
                          <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate">{a.filename}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          ({formatFileSize(a.filesize)})
                        </span>
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 shrink-0 px-1.5 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveAttachment(a.id)}
                        disabled={removingAttachmentId === a.id}
                        aria-label="Удалить файл"
                      >
                        {removingAttachmentId === a.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <X className="size-3.5" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Нет</p>
              )}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingFile}
                >
                  {isUploadingFile ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                  Прикрепить файл
                </Button>
                {attachmentError && (
                  <p className="mt-1 text-xs text-destructive">
                    {attachmentError}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between border-b">
              <CardTitle>Наблюдатели</CardTitle>
              {user &&
                (() => {
                  const isSelfWatching =
                    issue.watchers?.some((w) => w.id === user.id) ?? false;
                  return (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => handleToggleSelfWatch(isSelfWatching)}
                      disabled={isTogglingSelfWatch}
                    >
                      {isTogglingSelfWatch ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : isSelfWatching ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                      {isSelfWatching ? "Не наблюдать" : "Наблюдать"}
                    </Button>
                  );
                })()}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {issue.watchers && issue.watchers.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {issue.watchers.map((w) => (
                    <li
                      key={w.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-sm">{w.name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 shrink-0 px-1.5 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveWatcher(w.id)}
                        disabled={removingWatcherId === w.id}
                        aria-label="Убрать наблюдателя"
                      >
                        {removingWatcherId === w.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <X className="size-3.5" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Нет</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Select value={watcherInput} onValueChange={setWatcherInput}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Участник проекта" />
                  </SelectTrigger>
                  <SelectContent>
                    {members
                      .filter(
                        (m) => !issue.watchers?.some((w) => w.id === m.id),
                      )
                      .map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => handleAddWatcher(Number(watcherInput))}
                  disabled={!watcherInput || isAddingWatcher}
                >
                  {isAddingWatcher && (
                    <Loader2 className="size-3.5 animate-spin" />
                  )}
                  <Plus className="size-3.5" />
                  Добавить наблюдателя
                </Button>
              </div>
              {watcherError && (
                <p className="text-xs text-destructive">{watcherError}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between border-b">
              <CardTitle>Время</CardTitle>
              <LogTimeDialog
                client={client}
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
                Потрачено всего:{" "}
                {issue.spent_hours != null
                  ? `${issue.spent_hours.toFixed(2)} ч`
                  : "0 ч"}
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
                  issue.journals.map((j) => (
                    <JournalEntry
                      key={j.id}
                      journal={j}
                      customFieldNames={customFieldNames}
                    />
                  ))
                ) : (
                  <p className="py-2 text-sm text-muted-foreground">
                    Пока пусто
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <Textarea
                  placeholder="Добавить комментарий..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="w-fit"
                  disabled={!comment.trim() || isSavingComment}
                  onClick={handleAddComment}
                >
                  {isSavingComment && (
                    <Loader2 className="size-3.5 animate-spin" />
                  )}
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
