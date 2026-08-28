import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { ChevronDown, LayoutTemplate, Loader2, Trash2 } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  IssueFormFields,
  type IssueFormValues,
} from "@/components/issues/IssueFormFields";
import { SaveTemplateDialog } from "@/components/issues/SaveTemplateDialog";
import type { UploadedFile } from "@/api/attachments";
import type { RedmineClient } from "@/api/client";
import type { AuthUser } from "@/contexts/AuthContext";
import type { Project } from "@/hooks/useProjects";
import { useTrackers } from "@/hooks/useTrackers";
import {
  useIssuePriorities,
  type IssuePriority,
} from "@/hooks/useIssuePriorities";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { useProjectCategories } from "@/hooks/useProjectCategories";
import { useProjectVersions } from "@/hooks/useProjectVersions";
import { useIssueTemplates } from "@/hooks/useIssueTemplates";
import { useCustomFieldDefinitions } from "@/hooks/useCustomFieldDefinitions";
import {
  createIssue,
  type IssueCreateInput,
  type IssueSummary,
} from "@/api/issues";

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
  customFields: [],
};

function defaultPriorityId(priorities: IssuePriority[]): number | null {
  return priorities.find((p) => p.isDefault)?.id ?? priorities[0]?.id ?? null;
}

export interface CreateIssueDialogProps {
  /** Без trigger диалог управляется только снаружи через open/onOpenChange (см. хоткей "c" в AppLayout). */
  trigger?: ReactNode;
  client: RedmineClient | null;
  /** Проекты для селектора - вызывающий должен отфильтровать по праву add_issues (см. IssuesPage). */
  projects: Project[];
  /** Проект по умолчанию для новой задачи - например, текущий фильтр в Topbar. */
  defaultProjectId?: number | null;
  /** Текущий пользователь - подмешивается в список исполнителей, см. useProjectMembers. */
  currentUser?: AuthUser | null;
  /** Для шаблонов задач (localStorage, ключ по инстансу+пользователю) - см. useIssueTemplates. */
  baseUrl?: string | null;
  onCreated: (issue: IssueSummary) => void;
  /** Управляемое состояние открытия - если не передано, диалог сам открывается по клику на trigger. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  currentUser,
  baseUrl,
  onCreated,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: CreateIssueDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;
  const [projectId, setProjectId] = useState<number | null>(null);
  const [values, setValues] = useState<IssueFormValues>(EMPTY_VALUES);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // #42 - последняя созданная через "Создать и ещё" задача (диалог остаётся
  // открытым, показываем подтверждение со ссылкой).
  const [lastCreated, setLastCreated] = useState<IssueSummary | null>(null);
  // Файлы, вставленные по Ctrl+V в описание, пока задачи ещё не существует -
  // токены отправятся вместе с созданием задачи (см. handleSubmit). См.
  // CLAUDE.md, "Markdown-редактор".
  const [pendingUploads, setPendingUploads] = useState<UploadedFile[]>([]);

  const { trackers } = useTrackers(client);
  const { priorities } = useIssuePriorities(client);
  const { members } = useProjectMembers(client, projectId, currentUser);
  const { categories } = useProjectCategories(client, projectId);
  const { versions } = useProjectVersions(client, projectId);
  const {
    templates,
    save: saveTemplate,
    remove: removeTemplate,
  } = useIssueTemplates(baseUrl ?? null, currentUser?.id);
  const { definitions: customFieldDefinitions } =
    useCustomFieldDefinitions(client);

  const projectFieldId = useId();

  // Приоритет по умолчанию - когда справочник приоритетов подгрузился и форма еще пустая.
  useEffect(() => {
    if (open && priorities.length > 0 && values.priorityId === null) {
      setValues((v) => ({ ...v, priorityId: defaultPriorityId(priorities) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, priorities]);

  // Сброс формы при открытии - вынесено из onOpenChange в эффект, потому что
  // при управляемом open (см. хоткей "c" в AppLayout.tsx) Radix не вызывает
  // onOpenChange для переходов, инициированных снаружи (только для
  // собственных - клика по оверлею/Esc/DialogTrigger), иначе форма
  // открывалась бы с данными от предыдущего открытия.
  //
  // Важно: этот эффект должен идти РАНЬШЕ эффекта пользовательских полей
  // ниже - React выполняет эффекты одного коммита в порядке объявления, а
  // оба зависят от [open]. Если бы порядок был обратный, сброс формы здесь
  // отрабатывал бы после того, как эффект полей уже проставил customFields,
  // и затирал бы их обратно в [] на каждое открытие диалога - ровно так и
  // было до фикса, поймано сквозным прогоном в браузере (админские
  // is_for_all-поля не показывались вообще, хотя GET /custom_fields.json
  // отрабатывал успешно).
  useEffect(() => {
    if (!open) return;
    // defaultProjectId годится, только если он есть в списке projects - тот
    // уже отфильтрован по правам (add_issues) на стороне вызывающего (см.
    // IssuesPage/AppLayout) - иначе откатываемся на первый доступный проект.
    const defaultIsAllowed =
      defaultProjectId != null &&
      projects.some((p) => p.id === defaultProjectId);
    setProjectId(
      defaultIsAllowed ? defaultProjectId! : (projects[0]?.id ?? null),
    );
    setValues(EMPTY_VALUES);
    setFormError(null);
    setPendingUploads([]);
    setLastCreated(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Пользовательские поля, применимые к выбранному трекеру - доступны только
  // если GET /custom_fields.json вообще отдал данные (только для админов,
  // см. useCustomFieldDefinitions). Для не-админов customFieldDefinitions
  // пуст - секция просто не появится, это ожидаемое поведение, не баг
  // (см. CLAUDE.md, "Custom fields").
  //
  // Не полагаемся на d.is_for_all - реальный Redmine (проверено на локальном
  // инстансе) молча не отдаёт этот ключ в JSON вообще, ни истинный, ни
  // ложный (похоже на баг сериализации в самом Redmine, не в нашем клиенте).
  // Вместо него - members d.trackers: поле применимо к задаче, только если
  // оно явно привязано к её трекеру. Проверено экспериментально через rails
  // console на локальном инстансе - ПУСТОЙ trackers означает "ни к одному
  // трекеру", а НЕ "ко всем" (даже у поля с is_for_all=true в БД): Redmine
  // молча не сохраняет значение такого поля вообще, полагаться на "пустой
  // список = применимо всегда" нельзя, это ложная эвристика (мой первый
  // вариант был неверен - см. историю коммитов). is_for_all - это отдельная
  // ось (разрешает не привязывать поле к каждому ПРОЕКТУ по отдельности), не
  // заменяет привязку к трекеру.
  useEffect(() => {
    if (!open || customFieldDefinitions.length === 0) return;
    const applicable = customFieldDefinitions.filter(
      (d) =>
        d.customized_type === "issue" &&
        d.trackers?.some((t) => t.id === values.trackerId),
    );
    setValues((v) => ({
      ...v,
      customFields: applicable.map((d) => {
        const existing = v.customFields.find((f) => f.id === d.id);
        return {
          id: d.id,
          name: d.name,
          value: existing?.value ?? d.default_value ?? (d.multiple ? [] : ""),
          fieldFormat: d.field_format,
          possibleValues: d.possible_values,
          multiple: d.multiple,
        };
      }),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, values.trackerId, customFieldDefinitions]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
  }

  function updateField<K extends keyof IssueFormValues>(
    field: K,
    value: IssueFormValues[K],
  ) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  function applyTemplate(id: string) {
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setValues((v) => ({
      ...v,
      trackerId: template.trackerId ?? v.trackerId,
      priorityId: template.priorityId ?? v.priorityId,
      categoryId: template.categoryId ?? v.categoryId,
      description: template.description || v.description,
    }));
  }

  function handleSaveTemplate(name: string) {
    saveTemplate({
      name,
      trackerId: values.trackerId,
      priorityId: values.priorityId,
      categoryId: values.categoryId,
      description: values.description,
    });
  }

  async function handleSubmit(e: FormEvent | undefined, andAnother = false) {
    e?.preventDefault();
    setFormError(null);
    setLastCreated(null);

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
    if (
      parsedEstimatedHours !== null &&
      !Number.isFinite(parsedEstimatedHours)
    ) {
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
      customFields:
        values.customFields.length > 0
          ? values.customFields.map((f) => ({ id: f.id, value: f.value }))
          : undefined,
      // Файлы, вставленные по Ctrl+V в описание до сохранения формы (см.
      // MarkdownEditor/pendingUploads выше) - без этого токены загрузки
      // остались бы висеть непривязанными ни к какой задаче.
      uploads: pendingUploads.length > 0 ? pendingUploads : undefined,
    };

    setIsSubmitting(true);
    try {
      const issue = await createIssue(client!, input);
      if (andAnother) {
        // Оставляем диалог открытым, чистим только тему/описание/сроки -
        // проект/трекер/приоритет/исполнитель/версия остаются для серии
        // однотипных задач.
        setValues((v) => ({
          ...v,
          subject: "",
          description: "",
          startDate: "",
          dueDate: "",
          doneRatio: 0,
          estimatedHours: "",
        }));
        setPendingUploads([]);
        setLastCreated(issue);
      } else {
        setOpen(false);
        onCreated(issue);
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Не удалось создать задачу.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            {/* pr-8 - место под встроенную кнопку закрытия DialogContent (absolute top-2 right-2, ~28px) - иначе "Шаблон" наезжает на неё. */}
            <div className="flex items-center justify-between gap-2 pr-8">
              <DialogTitle>Новая задача</DialogTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                  >
                    <LayoutTemplate className="size-3.5" />
                    Шаблон
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {templates.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Шаблонов пока нет
                    </div>
                  )}
                  {templates.map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onSelect={() => applyTemplate(t.id)}
                      className="justify-between gap-2"
                    >
                      {t.name}
                      <button
                        type="button"
                        aria-label={`Удалить шаблон «${t.name}»`}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTemplate(t.id);
                        }}
                        className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <SaveTemplateDialog
                    onSave={handleSaveTemplate}
                    trigger={
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        Сохранить текущее как шаблон...
                      </DropdownMenuItem>
                    }
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
                client={client}
                onDescriptionUpload={(f) =>
                  setPendingUploads((prev) => [...prev, f])
                }
              />
            </div>
          </div>

          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          {lastCreated && (
            <p className="text-sm text-emerald-600">
              Создана{" "}
              <button
                type="button"
                className="font-medium underline"
                onClick={() => {
                  const created = lastCreated;
                  setOpen(false);
                  onCreated(created);
                }}
              >
                #{lastCreated.id}
              </button>{" "}
              «{lastCreated.subject}». Форма готова к следующей.
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => void handleSubmit(undefined, true)}
            >
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
              Создать и ещё
            </Button>
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
