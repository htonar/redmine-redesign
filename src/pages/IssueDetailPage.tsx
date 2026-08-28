import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
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
import { useIssueStatuses } from "@/hooks/useIssueStatuses";
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
} from "@/api/issues";
import { createTimeEntry, type TimeEntryInput } from "@/api/timeEntries";
import {
  deleteAttachment,
  uploadAttachment,
  type Attachment,
  type UploadedFile,
} from "@/api/attachments";
import { AttachmentPreviewDialog } from "@/components/issues/AttachmentPreviewDialog";
import { addWatcher, removeWatcher } from "@/api/watchers";
import { JournalEntry } from "@/components/issues/JournalEntry";
import { IssuePicker } from "@/components/issues/IssuePicker";
import { BranchNameButton } from "@/components/issues/BranchNameButton";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { MarkdownEditor } from "@/components/markdown/MarkdownEditor";
import {
  RELATION_TYPE_OPTIONS,
  describeIssueRelation,
} from "@/lib/issue-relations";
import { dueDateState } from "@/lib/issue-visuals";
import { formatRelativeTime, fullTimestamp } from "@/lib/relative-time";
import { formatFileSize } from "@/lib/utils";
import { celebrate } from "@/lib/celebrate";
import { diffFormValues, formatCustomFieldValue } from "@/lib/issue-form";
import { issueUrl } from "@/lib/redmine-url";
import { openExternal } from "@/lib/open-external";
import { isTauri } from "@tauri-apps/api/core";
import { chatCompletion } from "@/api/ai";
import { buildTldrMessages } from "@/lib/ai-tldr-prompt";
import { isAiConfigured, loadAiSettings } from "@/lib/ai-settings-storage";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  const { client, can, user, baseUrl } = useAuth();
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
  const { statuses } = useIssueStatuses(client);

  // Карты id -> имя для истории изменений (JournalEntry) - без них
  // status_id/priority_id/... в журнале показывают голые числа (issue,
  // repoted вручную). project_id сюда не входит - смена проекта задачи
  // штука редкая, и нужен был бы отдельный справочник "все проекты"
  // ради одного поля, не оправдано.
  const journalValueMaps = useMemo(
    () => ({
      status_id: Object.fromEntries(statuses.map((s) => [s.id, s.name])),
      priority_id: Object.fromEntries(priorities.map((p) => [p.id, p.name])),
      tracker_id: Object.fromEntries(trackers.map((t) => [t.id, t.name])),
      fixed_version_id: Object.fromEntries(
        versions.map((v) => [v.id, v.name]),
      ),
      category_id: Object.fromEntries(categories.map((c) => [c.id, c.name])),
      assigned_to_id: Object.fromEntries(
        members.map((m) => [m.id, m.name]),
      ),
    }),
    [statuses, priorities, trackers, versions, categories, members],
  );
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
  // #40 - показывать ли пустые поля метаданных в сайдбаре.
  const [showAllFields, setShowAllFields] = useState(false);
  // #39 - фильтр истории и раскрытие полной ленты.
  const [historyFilter, setHistoryFilter] = useState<
    "all" | "comments" | "changes"
  >("all");
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Файлы, вставленные по Ctrl+V в комментарий - см. MarkdownEditor, CLAUDE.md
  // "Markdown-редактор".
  const [pendingCommentUploads, setPendingCommentUploads] = useState<
    UploadedFile[]
  >([]);

  // TL;DR обсуждения через AI-ассистент (issue #23) - эфемерный результат,
  // не персистится. Кнопка видна только если AI настроен в /profile ->
  // "Настройки" (см. SettingsPage.tsx).
  type TldrState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "success"; text: string }
    | { status: "error"; message: string };
  const [tldrState, setTldrState] = useState<TldrState>({ status: "idle" });

  async function handleTldr() {
    const settings = loadAiSettings();
    if (!isAiConfigured(settings)) return;

    setTldrState({ status: "loading" });
    const messages = buildTldrMessages(issue?.description ?? undefined, issue?.journals ?? []);
    const result = await chatCompletion(settings, messages);

    if (result.ok) {
      setTldrState({ status: "success", text: result.text });
      return;
    }

    const message =
      result.error.kind === "invalid_key"
        ? "Неверный API-ключ"
        : result.error.kind === "rate_limited"
          ? "Превышен лимит запросов к AI-провайдеру"
          : result.error.kind === "network"
            ? "Нет соединения с AI-провайдером"
            : "Не удалось получить ответ от AI-провайдера";
    setTldrState({ status: "error", message });
  }

  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<IssueFormValues | null>(null);
  const [editInitialValues, setEditInitialValues] =
    useState<IssueFormValues | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  // Файлы, вставленные по Ctrl+V в описание в режиме правки - см.
  // MarkdownEditor, CLAUDE.md "Markdown-редактор".
  const [pendingDescriptionUploads, setPendingDescriptionUploads] = useState<
    UploadedFile[]
  >([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const [parentInput, setParentInput] = useState<number | null>(null);
  const [isEditingParent, setIsEditingParent] = useState(false);
  const [isSavingParent, setIsSavingParent] = useState(false);
  const [parentError, setParentError] = useState<string | null>(null);

  const [childInput, setChildInput] = useState<number | null>(null);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [childError, setChildError] = useState<string | null>(null);
  const [removingChildId, setRemovingChildId] = useState<number | null>(null);

  const [relationInput, setRelationInput] = useState<number | null>(null);
  const [relationType, setRelationType] =
    useState<IssueRelationType>("relates");
  const [isAddingRelation, setIsAddingRelation] = useState(false);
  const [relationError, setRelationError] = useState<string | null>(null);
  const [removingRelationId, setRemovingRelationId] = useState<number | null>(
    null,
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
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
    setPendingDescriptionUploads([]);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditValues(null);
    setEditInitialValues(null);
    setEditError(null);
    setPendingDescriptionUploads([]);
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

  // Ctrl/Cmd+S - сохранить форму правки задачи (по просьбе пользователя,
  // как альтернатива Ctrl+Enter в комментарии). В отличие от хоткея "e" выше,
  // работает даже когда фокус внутри самой формы (в полях/textarea) - иначе
  // сохранять было бы неоткуда, кроме мыши. Браузер по умолчанию перехватывает
  // Ctrl+S под "Сохранить страницу" - обязательно preventDefault.
  useEffect(() => {
    if (!isEditing) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      handleSaveEdit();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, editValues, editInitialValues]);

  function updateEditField<K extends keyof IssueFormValues>(
    field: K,
    value: IssueFormValues[K],
  ) {
    setEditValues((v) => (v ? { ...v, [field]: value } : v));
  }

  async function handleSetParent() {
    if (!client || !issue) return;
    if (parentInput === null) {
      setParentError("Укажите номер задачи.");
      return;
    }
    if (parentInput === issue.id) {
      setParentError("Задача не может быть родителем сама себе.");
      return;
    }
    setParentError(null);
    setIsSavingParent(true);
    try {
      await updateIssue(client, issue.id, { parentId: parentInput });
      setIsEditingParent(false);
      setParentInput(null);
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
    if (childInput === null) {
      setChildError("Укажите номер задачи.");
      return;
    }
    if (childInput === issue.id) {
      setChildError("Задача не может быть подзадачей сама себе.");
      return;
    }
    setChildError(null);
    setIsAddingChild(true);
    try {
      await updateIssue(client, childInput, { parentId: issue.id });
      setChildInput(null);
      reload();
    } catch (e) {
      setChildError(
        e instanceof Error ? e.message : "Не удалось добавить подзадачу.",
      );
    } finally {
      setIsAddingChild(false);
    }
  }

  /** Отвязать подзадачу - технически это снятие родителя у самой подзадачи (parentId: null), отдельного эндпоинта "убрать подзадачу" в Redmine нет. */
  async function handleRemoveChild(childId: number) {
    if (!client) return;
    setChildError(null);
    setRemovingChildId(childId);
    try {
      await updateIssue(client, childId, { parentId: null });
      reload();
    } catch (e) {
      setChildError(
        e instanceof Error ? e.message : "Не удалось отвязать подзадачу.",
      );
    } finally {
      setRemovingChildId(null);
    }
  }

  async function handleAddRelation() {
    if (!client || !issue) return;
    if (relationInput === null) {
      setRelationError("Укажите номер задачи.");
      return;
    }
    if (relationInput === issue.id) {
      setRelationError("Задача не может быть связана сама с собой.");
      return;
    }
    setRelationError(null);
    setIsAddingRelation(true);
    try {
      await createIssueRelation(client, issue.id, {
        issueToId: relationInput,
        relationType,
      });
      setRelationInput(null);
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

  async function handleUploadFiles(files: File[]) {
    if (!client || !issue || files.length === 0) return;
    setAttachmentError(null);
    setIsUploadingFile(true);
    try {
      const uploaded = [];
      for (const file of files) {
        uploaded.push(await uploadAttachment(client, file));
      }
      await updateIssue(client, issue.id, { uploads: uploaded });
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
    const files = Array.from(e.target.files ?? []);
    // Сбрасываем value - иначе повторный выбор того же файла не вызовет onChange.
    e.target.value = "";
    void handleUploadFiles(files);
  }

  // #41 - drag-and-drop файлов на карточку. dragDepth: dragleave стреляет и
  // при переходе на дочерний элемент, поэтому считаем вход/выход, а не
  // просто toggle.
  const dragDepthRef = useRef(0);
  function handleDragEnter(e: ReactDragEvent) {
    if (!e.dataTransfer.types.includes("Files")) return;
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  }
  function handleDragLeave() {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingFiles(false);
  }
  function handleDrop(e: ReactDragEvent) {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
    void handleUploadFiles(Array.from(e.dataTransfer.files));
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
    // Файлы, вставленные по Ctrl+V в описание (см. MarkdownEditor) - нужно
    // отправить, даже если больше ничего в форме не поменялось (иначе токен
    // загрузки останется никуда не прикреплённым).
    if (pendingDescriptionUploads.length > 0) {
      patch.uploads = pendingDescriptionUploads;
    }
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
      setPendingDescriptionUploads([]);
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

  async function handleCopyLink() {
    if (!baseUrl || !issue) return;
    try {
      await navigator.clipboard.writeText(issueUrl(baseUrl, issue.id));
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* буфер недоступен - молча, ссылка и так открывается пунктом выше */
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
      await updateIssue(client, issue.id, {
        notes: comment,
        uploads:
          pendingCommentUploads.length > 0 ? pendingCommentUploads : undefined,
      });
      setComment("");
      setPendingCommentUploads([]);
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
    <div
      className="relative flex flex-col gap-4"
      onDragEnter={handleDragEnter}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingFiles && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/80 text-sm font-medium text-primary">
          {isUploadingFile
            ? "Загрузка..."
            : "Отпустите файлы — прикрепим к задаче"}
        </div>
      )}
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
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-72" />
            </div>
            <Skeleton className="h-8 w-28" />
          </div>

          <Card>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        </div>
      )}

      {!isLoading && issue && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>
                  {issue.tracker?.name ?? "Задача"} #{issue.id}
                </span>
              </div>
              <h1 className="text-xl font-semibold tracking-tight">
                {issue.subject}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <BranchNameButton
                issueId={issue.id}
                subject={issue.subject}
                trackerName={issue.tracker?.name}
                projectIdentifier={issue.project?.name}
              />
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
              {can("log_time", projectId) && (
                <LogTimeDialog
                  client={client}
                  projects={projects}
                  activities={activities}
                  defaultProjectId={issue.project?.id}
                  defaultIssueId={issue.id}
                  onSubmit={handleLogTime}
                  trigger={
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Plus className="size-3.5" />
                      Время
                    </Button>
                  }
                />
              )}
              {/* Второстепенные и деструктивные действия - в "…"-меню (issue
                  #61), чтобы "Удалить" не стояло вплотную к частым кнопкам. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="px-2"
                    aria-label="Ещё действия"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {baseUrl && (
                    <DropdownMenuItem
                      onSelect={() => {
                        const url = issueUrl(baseUrl, issue.id);
                        if (isTauri()) openExternal(url);
                        else window.open(url, "_blank", "noreferrer");
                      }}
                    >
                      <ExternalLink className="size-3.5" />
                      Открыть в Redmine
                    </DropdownMenuItem>
                  )}
                  {baseUrl && (
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        void handleCopyLink();
                      }}
                    >
                      {linkCopied ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      {linkCopied ? "Скопировано" : "Копировать ссылку"}
                    </DropdownMenuItem>
                  )}
                  {can("delete_issues", projectId) && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={isDeleting}
                        onSelect={() => setIsDeleteDialogOpen(true)}
                      >
                        {isDeleting ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                        Удалить
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              {issue.priority?.name && (
                // h-8 px-3 - у Badge своя высота (h-5), заметно меньше
                // соседних кнопок/селекта (h-8) в этом ряду - на аудите
                // верстки бросалось в глаза как случайно уменьшенный
                // элемент. Выравниваем высоту, оставляя стиль "плашки"
                // (не кнопки - у неё нет действия по клику).
                <Badge variant="outline" className="h-8 px-3 text-sm">
                  {issue.priority.name}
                </Badge>
              )}
              {issue.allowed_statuses && issue.allowed_statuses.length > 0 ? (
                <Select
                  value={String(issue.status?.id ?? "")}
                  onValueChange={handleStatusChange}
                  disabled={isSavingStatus}
                >
                  <SelectTrigger className="w-40 sm:w-44">
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

          <AttachmentPreviewDialog
            attachment={previewAttachment}
            client={client}
            open={previewAttachment !== null}
            onOpenChange={(open) => !open && setPreviewAttachment(null)}
          />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <div className="flex min-w-0 flex-col gap-4">
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
                      doneRatioDerived={(issue.children?.length ?? 0) > 0}
                      client={client}
                      onDescriptionUpload={(f) =>
                        setPendingDescriptionUploads((prev) => [...prev, f])
                      }
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
                issue.description && (
                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle>Описание</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <MarkdownContent
                        text={issue.description}
                        attachments={issue.attachments}
                        client={client}
                      />
                    </CardContent>
                  </Card>
                )
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
                        {can("edit_issues", projectId) && (
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
                        )}
                      </div>
                    ) : !can("edit_issues", projectId) ? (
                      <EmptyState size="compact" title="Нет" />
                    ) : isEditingParent ? (
                      <div className="flex items-center gap-2">
                        <IssuePicker
                          client={client}
                          value={parentInput}
                          onChange={setParentInput}
                          projectId={projectId}
                          className="w-56"
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
                            setParentInput(null);
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
                      <ul className="flex flex-col gap-1.5">
                        {issue.children.map((c, i) => (
                          <li
                            key={c.id ?? i}
                            className="flex items-center justify-between gap-2"
                          >
                            <Link
                              to={`/issues/${c.id}`}
                              className="text-sm hover:underline"
                            >
                              #{c.id} — {c.subject ?? "—"}
                            </Link>
                            {can("edit_issues", projectId) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-muted-foreground hover:text-destructive"
                                onClick={() =>
                                  c.id != null && handleRemoveChild(c.id)
                                }
                                disabled={
                                  c.id == null || removingChildId === c.id
                                }
                                aria-label="Отвязать подзадачу"
                              >
                                {removingChildId === c.id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <X className="size-3.5" />
                                )}
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyState size="compact" title="Нет" />
                    )}
                    {can("edit_issues", projectId) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <IssuePicker
                          client={client}
                          value={childInput}
                          onChange={setChildInput}
                          projectId={projectId}
                          className="w-full sm:w-56"
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
                    )}
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
                          const label = describeIssueRelation(type, isForward);
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
                              {can("manage_issue_relations", projectId) && (
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
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <EmptyState size="compact" title="Нет" />
                    )}
                    {can("manage_issue_relations", projectId) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Select
                          value={relationType}
                          onValueChange={(v) =>
                            setRelationType(v as IssueRelationType)
                          }
                        >
                          <SelectTrigger className="w-full sm:w-44">
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
                        <IssuePicker
                          client={client}
                          value={relationInput}
                          onChange={setRelationInput}
                          projectId={projectId}
                          className="w-full sm:w-56"
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
                    )}
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
                            className="flex min-w-0 items-center gap-1.5 text-left hover:underline"
                            onClick={() => setPreviewAttachment(a)}
                          >
                            <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{a.filename}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              ({formatFileSize(a.filesize)})
                            </span>
                          </button>
                          {can("edit_issues", projectId) && (
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
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState size="compact" title="Нет" />
                  )}
                  {(can("edit_issues", projectId) ||
                    can("add_issue_notes", projectId)) && (
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
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between border-b">
                  <CardTitle>История и комментарии</CardTitle>
                  {isAiConfigured(loadAiSettings()) && (
                    <Popover
                      onOpenChange={(open) => {
                        // Не перезапрашиваем при повторном открытии, если уже
                        // есть результат (или запрос уже летит) - иначе каждое
                        // открытие popover тратит лишний запрос к AI-провайдеру.
                        // Ошибку допускаем повторить - мало ли, сеть/лимит
                        // временные.
                        if (open && tldrState.status !== "loading" && tldrState.status !== "success") {
                          handleTldr();
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          {tldrState.status === "loading" ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Sparkles className="size-4" />
                          )}
                          TL;DR
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent>
                        {tldrState.status === "loading" && (
                          <p className="text-muted-foreground">Суммаризирую...</p>
                        )}
                        {tldrState.status === "success" && <p>{tldrState.text}</p>}
                        {tldrState.status === "error" && (
                          <p className="text-destructive">{tldrState.message}</p>
                        )}
                        {tldrState.status === "idle" && (
                          <p className="text-muted-foreground">Суммаризирую...</p>
                        )}
                      </PopoverContent>
                    </Popover>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {(() => {
                    const allJournals = issue.journals ?? [];
                    if (allJournals.length === 0) {
                      return (
                        <p className="py-2 text-sm text-muted-foreground">
                          Пока пусто
                        </p>
                      );
                    }
                    const filtered = allJournals.filter((j) =>
                      historyFilter === "all"
                        ? true
                        : historyFilter === "comments"
                          ? Boolean(j.notes?.trim())
                          : j.details.length > 0,
                    );
                    const COLLAPSE_AT = 8;
                    const collapsed =
                      !historyExpanded && filtered.length > COLLAPSE_AT;
                    const shown = collapsed
                      ? filtered.slice(-COLLAPSE_AT)
                      : filtered;
                    const hiddenOlder = filtered.length - shown.length;
                    const FILTERS = [
                      ["all", "Всё"],
                      ["comments", "Комментарии"],
                      ["changes", "Изменения"],
                    ] as const;

                    return (
                      <>
                        <div className="flex items-center gap-1">
                          {FILTERS.map(([key, label]) => (
                            <Button
                              key={key}
                              variant={
                                historyFilter === key ? "secondary" : "ghost"
                              }
                              size="sm"
                              className="h-7 px-2 text-xs"
                              aria-pressed={historyFilter === key}
                              onClick={() => {
                                setHistoryFilter(key);
                                setHistoryExpanded(false);
                              }}
                            >
                              {label}
                            </Button>
                          ))}
                        </div>

                        {hiddenOlder > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto self-start px-1.5 py-1 text-xs text-muted-foreground"
                            onClick={() => setHistoryExpanded(true)}
                          >
                            Показать всю историю ({hiddenOlder} ещё)
                          </Button>
                        )}

                        <div className="flex flex-col">
                          {shown.length > 0 ? (
                            shown.map((j) => (
                              <JournalEntry
                                key={j.id}
                                journal={j}
                                customFieldNames={customFieldNames}
                                valueMaps={journalValueMaps}
                                attachments={issue.attachments}
                                client={client}
                              />
                            ))
                          ) : (
                            <p className="py-2 text-sm text-muted-foreground">
                              Нет записей этого типа
                            </p>
                          )}
                        </div>
                      </>
                    );
                  })()}

                  {can("add_issue_notes", projectId) && (
                    <div className="flex flex-col gap-2 border-t border-border pt-3">
                      <MarkdownEditor
                        client={client}
                        placeholder="Добавить комментарий..."
                        value={comment}
                        onChange={setComment}
                        onUpload={(f) =>
                          setPendingCommentUploads((prev) => [...prev, f])
                        }
                        onSubmitShortcut={handleAddComment}
                        rows={3}
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
                  )}
                </CardContent>
              </Card>
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              {!isEditing &&
                (() => {
                  // #40 - второстепенные поля: скрываем пустые, если не
                  // включён "показать все". Проект/Автор/Исполнитель/
                  // Обновлено/Готовность видны всегда.
                  const due = dueDateState(
                    issue.due_date,
                    issue.status?.is_closed ?? false,
                  );
                  const hasSubtasks = (issue.children?.length ?? 0) > 0;
                  const optional: {
                    label: string;
                    value: string | null;
                    className?: string;
                  }[] = [
                    {
                      label: "Категория",
                      value: issue.category?.name ?? null,
                    },
                    {
                      label: "Версия",
                      value: issue.fixed_version?.name ?? null,
                    },
                    {
                      label: "Начало",
                      value: issue.start_date
                        ? formatDate(issue.start_date)
                        : null,
                    },
                    {
                      label: "Срок",
                      value: issue.due_date ? formatDate(issue.due_date) : null,
                      className:
                        due === "overdue"
                          ? "text-red-600 dark:text-red-400 font-medium"
                          : due === "soon"
                            ? "text-orange-600 dark:text-orange-400 font-medium"
                            : undefined,
                    },
                    {
                      label: "Оценка",
                      value:
                        issue.estimated_hours != null
                          ? `${issue.estimated_hours} ч`
                          : null,
                    },
                    {
                      label: "Потрачено",
                      value: issue.spent_hours
                        ? `${issue.spent_hours.toFixed(2)} ч`
                        : null,
                    },
                    ...(issue.custom_fields ?? []).map((f) => ({
                      label: f.name,
                      value:
                        formatCustomFieldValue(f, customFieldDefinitions) || null,
                    })),
                  ];
                  const hiddenCount = optional.filter(
                    (f) => !f.value,
                  ).length;
                  const visible = optional.filter(
                    (f) => showAllFields || f.value,
                  );

                  return (
                    <Card>
                      {hiddenCount > 0 && (
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle className="text-xs font-normal text-muted-foreground">
                            {showAllFields
                              ? "Все поля"
                              : `Скрыто пустых: ${hiddenCount}`}
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto px-1.5 py-0.5 text-xs text-muted-foreground"
                            onClick={() => setShowAllFields((v) => !v)}
                          >
                            {showAllFields ? "Скрыть пустые" : "Показать все"}
                          </Button>
                        </CardHeader>
                      )}
                      <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-1">
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
                        <Field label="Обновлено">
                          <span title={fullTimestamp(issue.updated_on)}>
                            {formatRelativeTime(issue.updated_on)}
                          </span>
                        </Field>
                        {visible.map((f) => (
                          <Field key={f.label} label={f.label}>
                            {f.value ? (
                              <span className={f.className}>{f.value}</span>
                            ) : (
                              "—"
                            )}
                          </Field>
                        ))}
                        <div className="col-span-2 sm:col-span-3 lg:col-span-1">
                          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                            <span>Готовность</span>
                            <span>{issue.done_ratio}%</span>
                          </div>
                          <Progress value={issue.done_ratio} />
                          {hasSubtasks && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Может рассчитываться по подзадачам - тогда
                              ручное значение Redmine игнорирует.
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

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
                          {(w.id === user?.id ||
                            can("delete_issue_watchers", projectId)) && (
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
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState size="compact" title="Нет" />
                  )}
                  {can("add_issue_watchers", projectId) && (
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
                  )}
                  {watcherError && (
                    <p className="text-xs text-destructive">{watcherError}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex items-center justify-between border-b">
                  <CardTitle>Время</CardTitle>
                  {can("log_time", projectId) && (
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
                  )}
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}
