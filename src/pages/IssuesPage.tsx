import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  ChevronDown,
  ExternalLink,
  Kanban,
  List,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { SaveViewDialog } from "@/components/issues/SaveViewDialog";
import { CreateIssueDialog } from "@/components/issues/CreateIssueDialog";
import { KanbanBoard } from "@/components/issues/KanbanBoard";
import { KanbanColumnSettings } from "@/components/issues/KanbanColumnSettings";
import { ListColumnSettings } from "@/components/issues/ListColumnSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useIssues } from "@/hooks/useIssues";
import { useIssueViews } from "@/hooks/useIssueViews";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useProjects } from "@/hooks/useProjects";
import { useQueries } from "@/hooks/useQueries";
import { useTrackers } from "@/hooks/useTrackers";
import { useIssuePriorities } from "@/hooks/useIssuePriorities";
import { useProjectVersions } from "@/hooks/useProjectVersions";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { useIssueStatuses } from "@/hooks/useIssueStatuses";
import { useKanbanColumnPrefs } from "@/hooks/useKanbanColumnPrefs";
import {
  ActiveFilterChips,
  EMPTY_ADVANCED_FILTERS,
  IssueFilterPanel,
  type AdvancedIssueFilters,
} from "@/components/issues/IssueFilterPanel";
import {
  deleteIssue,
  updateIssue,
  type IssueListFilters,
} from "@/api/issues";
import { addWatcher } from "@/api/watchers";
import { runBulk, summarizeBulk, type BulkResult } from "@/lib/bulk-runner";
import { BulkActionBar } from "@/components/issues/BulkActionBar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { parseSort, toggleSort as toggleSortValue } from "@/lib/issue-sort";
import { issueUrl } from "@/lib/redmine-url";
import { openExternal } from "@/lib/open-external";
import { cn } from "@/lib/utils";
import { useListKeyboardNav } from "@/hooks/useListKeyboardNav";
import {
  dueDateState,
  priorityTextClass,
  statusBadgeClass,
} from "@/lib/issue-visuals";
import {
  visibleOrderedColumns,
  type ListColumnDef,
} from "@/lib/list-columns";
import { useListColumnPrefs } from "@/hooks/useListColumnPrefs";
import { formatRelativeTime, fullTimestamp } from "@/lib/relative-time";
import { isTauri } from "@tauri-apps/api/core";
import type { IssueView } from "@/lib/issue-views-storage";
import { useLayoutContext } from "./AppLayout";

const DEFAULT_FILTERS: Pick<IssueListFilters, "assignee" | "status" | "sort"> =
  {
    assignee: "me",
    status: "open",
    sort: "updated_on:desc",
  };

/**
 * Персистится одним объектом (issue #6) - "что было открыто в последний раз",
 * не путать с сохраненными видами (useIssueViews - именованные, создаются
 * вручную). queryId включен сюда же - тоже часть "текущего вида" списка.
 */
interface PersistedIssueFilters {
  assignee: IssueListFilters["assignee"];
  status: IssueListFilters["status"];
  sort: string;
  queryId: number | null;
  advanced: AdvancedIssueFilters;
}

const DEFAULT_PERSISTED_FILTERS: PersistedIssueFilters = {
  ...DEFAULT_FILTERS,
  queryId: null,
  advanced: EMPTY_ADVANCED_FILTERS,
};

/** Сентинел для пункта "без query" в Select - Radix Select не допускает value="". */
const NO_QUERY = "__none__";

/** Сентинел для пункта "Не назначено" в инлайн-Select исполнителя (issue #36). */
const UNASSIGNED = "__unassigned__";

const DATE_FMT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

/**
 * Список задач: фильтры (проект - в Topbar, исполнитель, статус), сортировка,
 * сохраненные виды. Дефолт - "мои открытые задачи", см. CLAUDE.md раздел
 * "Список задач: фильтры, сортировка, сохраненные виды".
 */
export function IssuesPage() {
  const navigate = useNavigate();
  const { client, baseUrl, user, can } = useAuth();
  const { selectedProjectId, setSelectedProjectId } = useLayoutContext();
  const [persistedFilters, setPersistedFilters] = usePersistedState<PersistedIssueFilters>(
    baseUrl,
    user?.id,
    "issues-filters",
    DEFAULT_PERSISTED_FILTERS,
  );
  const { assignee, status, sort, queryId } = persistedFilters;
  // advanced может отсутствовать в старом персисте (issue #29) - подстраховка.
  const advanced = persistedFilters.advanced ?? EMPTY_ADVANCED_FILTERS;
  const setAssignee = (value: IssueListFilters["assignee"]) =>
    setPersistedFilters((prev) => ({ ...prev, assignee: value }));
  const setStatus = (value: IssueListFilters["status"]) =>
    setPersistedFilters((prev) => ({ ...prev, status: value }));
  const setSort = (value: string) =>
    setPersistedFilters((prev) => ({ ...prev, sort: value }));

  // Deep-link из stat-карточек дашборда (issue #54): ?assignee=&status=
  // применяются один раз к персисту и убираются из URL, чтобы не перетирать
  // выбор пользователя на каждый рендер.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const a = searchParams.get("assignee");
    const s = searchParams.get("status");
    if (!a && !s) return;
    setPersistedFilters((prev) => ({
      ...prev,
      assignee: a === "me" || a === "all" ? a : prev.assignee,
      status:
        s === "open" || s === "closed" || s === "all" ? s : prev.status,
      queryId: null,
    }));
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setAdvanced = (next: AdvancedIssueFilters) =>
    setPersistedFilters((prev) => ({ ...prev, advanced: next }));
  // Нативный Query Redmine (issue #14) - когда выбран, Redmine игнорирует
  // остальные фильтры на сервере (project/assignee/status), поэтому UI их
  // дизейблит, а не позволяет думать, что они применяются одновременно.
  const setQueryId = (value: number | null) =>
    setPersistedFilters((prev) => ({ ...prev, queryId: value }));
  // Не "view" - это имя уже занято переменной цикла для сохраненных видов (IssueView) ниже.
  // Отдельный персист-ключ, не часть persistedFilters - переключение
  // канбан/таблица не связано с сохраненными видами (issue #17).
  const [layout, setLayout] = usePersistedState<"table" | "kanban">(
    baseUrl,
    user?.id,
    "issues-layout",
    "table",
  );

  const filters: IssueListFilters = {
    projectId: selectedProjectId ?? undefined,
    assignee,
    status,
    sort,
    queryId: queryId ?? undefined,
    trackerId: advanced.trackerId ?? undefined,
    priorityId: advanced.priorityId ?? undefined,
    versionId: advanced.versionId ?? undefined,
    authorId: advanced.authorId ?? undefined,
    subject: advanced.subject.trim() || undefined,
  };

  const {
    issues,
    totalCount,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    patchIssue,
    reload: reloadIssues,
  } = useIssues(client, filters);
  const { views, save, remove } = useIssueViews(baseUrl, user?.id);
  const { projects } = useProjects(client);
  const { queries } = useQueries(client);
  const { trackers } = useTrackers(client);
  const { priorities } = useIssuePriorities(client);
  const { statuses } = useIssueStatuses(client);
  const { versions } = useProjectVersions(client, selectedProjectId);
  const { members } = useProjectMembers(client, selectedProjectId, user);
  const [kanbanColumnPrefs, setKanbanColumnPrefs] = useKanbanColumnPrefs(
    baseUrl,
    user?.id,
    selectedProjectId ?? 0,
  );
  const [columnPrefs, setColumnPrefs] = useListColumnPrefs(baseUrl, user?.id);
  const visibleCols = useMemo(
    () => visibleOrderedColumns(columnPrefs),
    [columnPrefs],
  );
  const priorityOrder = useMemo(
    () => priorities.map((p) => ({ id: p.id, isDefault: p.isDefault })),
    [priorities],
  );

  // Версия и автор привязаны к проекту - при смене проекта в шапке
  // сбрасываем их, иначе остаётся id из чужого проекта и список молча пуст.
  const prevProjectRef = useRef(selectedProjectId);
  useEffect(() => {
    if (prevProjectRef.current === selectedProjectId) return;
    prevProjectRef.current = selectedProjectId;
    if (advanced.versionId !== null || advanced.authorId !== null) {
      setAdvanced({ ...advanced, versionId: null, authorId: null });
    }
    // setAdvanced - тонкая обёртка над сеттером persisted-стейта, не мемоизирована
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, advanced]);

  const { field: sortField, dir: sortDir } = parseSort(sort);

  // j/k + Enter по строкам таблицы (issue #46).
  const { index: navIndex, setActiveRef: setNavActiveRef } = useListKeyboardNav(
    issues,
    (issue) => navigate(`/issues/${issue.id}`),
    layout === "table",
  );

  function toggleSort(field: string) {
    setSort(toggleSortValue(sort, field));
  }

  // Инлайн-правка статуса/исполнителя прямо в строке (issue #36) -
  // оптимистично, с откатом при ошибке. Строка помечается id, пока идёт запрос.
  const [inlineBusyId, setInlineBusyId] = useState<number | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  async function inlinePatch(
    id: number,
    patch: { statusId: number } | { assignedToId: number | null },
    optimistic: Partial<(typeof issues)[number]>,
    rollback: Partial<(typeof issues)[number]>,
  ) {
    if (!client) return;
    setInlineBusyId(id);
    setInlineError(null);
    patchIssue(id, optimistic);
    try {
      await updateIssue(client, id, patch);
    } catch (e) {
      patchIssue(id, rollback);
      setInlineError(
        e instanceof Error ? e.message : "Не удалось сохранить изменение.",
      );
    } finally {
      setInlineBusyId(null);
    }
  }

  // --- Множественный выбор и групповые действия (issue #37) ---
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Убираем из выбора id, которых больше нет в загруженном списке (сменились
  // фильтры / прошло удаление).
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const present = new Set(issues.map((i) => i.id));
      const next = new Set([...prev].filter((id) => present.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [issues]);

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === issues.length ? new Set() : new Set(issues.map((i) => i.id)),
    );
  }

  async function runBulkAction(task: (id: number) => Promise<void>) {
    if (!client || selectedIds.size === 0 || bulkBusy) return;
    const ids = [...selectedIds];
    setBulkBusy(true);
    setBulkResult(null);
    setBulkProgress({ done: 0, total: ids.length });
    const result = await runBulk(ids, task, {
      onProgress: (done, total) => setBulkProgress({ done, total }),
    });
    setBulkBusy(false);
    setBulkProgress(null);
    setBulkResult(result);
    setSelectedIds(new Set());
    reloadIssues();
  }

  function applyView(view: IssueView) {
    setAssignee(view.filters.assignee);
    setStatus(view.filters.status);
    setSort(view.filters.sort);
    setSelectedProjectId(view.filters.projectId ?? null);
    setQueryId(view.filters.queryId ?? null);
    setAdvanced({
      trackerId: view.filters.trackerId ?? null,
      priorityId: view.filters.priorityId ?? null,
      versionId: view.filters.versionId ?? null,
      authorId: view.filters.authorId ?? null,
      subject: view.filters.subject ?? "",
    });
  }

  // Проекты, где у пользователя есть add_issues - и для решения "показывать ли
  // кнопку вообще", и как список для селектора внутри диалога (см.
  // docs/permissions.md). Если в Topbar выбран конкретный проект без прав -
  // кнопку скрываем совсем, не подсовывая создание в другом проекте вместо
  // выбранного.
  const creatableProjects = useMemo(
    () => projects.filter((p) => can("add_issues", p.id)),
    [projects, can],
  );
  const canCreateIssue =
    creatableProjects.length > 0 &&
    (selectedProjectId === null || can("add_issues", selectedProjectId));

  // --- Рендер ячеек настраиваемых колонок списка (issue #56) ---
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("ru-RU", DATE_FMT) : "-";

  type Row = (typeof issues)[number];

  function renderStatusCell(issue: Row) {
    if (can("edit_issues", issue.project?.id) && statuses.length > 0) {
      return (
        <Select
          value={String(issue.status?.id ?? "")}
          disabled={inlineBusyId === issue.id}
          onValueChange={(v) => {
            const next = statuses.find((s) => String(s.id) === v);
            if (!next || next.id === issue.status?.id) return;
            const prev = issue.status;
            void inlinePatch(
              issue.id,
              { statusId: next.id },
              {
                status: {
                  id: next.id,
                  name: next.name,
                  is_closed: next.isClosed,
                },
              },
              { status: prev },
            );
          }}
        >
          <SelectTrigger
            size="sm"
            className="relative z-10 h-7 w-[8.5rem] border-transparent bg-transparent px-2 hover:bg-accent"
            aria-label="Статус задачи"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return (
      issue.status && (
        <Badge variant="outline" className={statusBadgeClass(issue.status)}>
          {issue.status.name}
        </Badge>
      )
    );
  }

  function renderAssigneeCell(issue: Row) {
    if (
      selectedProjectId &&
      members.length > 0 &&
      can("edit_issues", issue.project?.id)
    ) {
      return (
        <Select
          value={
            issue.assigned_to ? String(issue.assigned_to.id) : UNASSIGNED
          }
          disabled={inlineBusyId === issue.id}
          onValueChange={(v) => {
            const nextId = v === UNASSIGNED ? null : Number(v);
            if (nextId === (issue.assigned_to?.id ?? null)) return;
            const prev = issue.assigned_to;
            const nextMember = members.find((m) => m.id === nextId);
            void inlinePatch(
              issue.id,
              { assignedToId: nextId },
              {
                assigned_to: nextMember
                  ? { id: nextMember.id, name: nextMember.name }
                  : undefined,
              },
              { assigned_to: prev },
            );
          }}
        >
          <SelectTrigger
            size="sm"
            className="relative z-10 h-7 w-[10rem] border-transparent bg-transparent px-2 hover:bg-accent"
            aria-label="Исполнитель задачи"
          >
            <SelectValue placeholder="Не назначено" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>Не назначено</SelectItem>
            {issue.assigned_to &&
              !members.some((m) => m.id === issue.assigned_to!.id) && (
                <SelectItem value={String(issue.assigned_to.id)}>
                  {issue.assigned_to.name}
                </SelectItem>
              )}
            {members.map((m) => (
              <SelectItem key={m.id} value={String(m.id)}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return issue.assigned_to?.name ?? "-";
  }

  function renderCell(col: ListColumnDef, issue: Row) {
    switch (col.id) {
      case "id":
        return (
          <Link
            to={`/issues/${issue.id}`}
            className="after:absolute after:inset-0 after:content-['']"
            aria-label={`Открыть задачу #${issue.id}`}
          >
            #{issue.id}
          </Link>
        );
      case "subject":
        return issue.subject;
      case "tracker":
        return issue.tracker?.name ?? "-";
      case "priority":
        return (
          <span className={priorityTextClass(issue.priority, priorityOrder)}>
            {issue.priority?.name ?? "-"}
          </span>
        );
      case "status":
        return renderStatusCell(issue);
      case "assigned_to":
        return renderAssigneeCell(issue);
      case "updated_on":
        return formatRelativeTime(issue.updated_on);
      case "project":
        return issue.project?.name ?? "-";
      case "due_date": {
        const st = dueDateState(
          issue.due_date,
          issue.status?.is_closed ?? false,
        );
        return (
          <span
            className={cn(
              st === "overdue" && "font-medium text-red-600 dark:text-red-400",
              st === "soon" &&
                "font-medium text-orange-600 dark:text-orange-400",
            )}
          >
            {fmtDate(issue.due_date)}
          </span>
        );
      }
      case "done_ratio":
        return `${issue.done_ratio}%`;
      case "category":
        return issue.category?.name ?? "-";
      case "fixed_version":
        return issue.fixed_version?.name ?? "-";
      case "start_date":
        return fmtDate(issue.start_date);
      case "estimated_hours":
        return issue.estimated_hours != null
          ? `${issue.estimated_hours} ч`
          : "-";
      case "spent_hours":
        return issue.spent_hours != null
          ? `${issue.spent_hours.toFixed(2)} ч`
          : "-";
      default:
        return null;
    }
  }

  const COL_BODY_CLASS: Partial<Record<ListColumnDef["id"], string>> = {
    id: "text-muted-foreground",
    subject: "max-w-[45vw] truncate font-medium sm:max-w-xs",
    tracker: "text-muted-foreground",
    priority: "font-medium",
    updated_on: "text-muted-foreground",
    project: "text-muted-foreground",
    start_date: "text-muted-foreground",
    done_ratio: "text-muted-foreground",
    estimated_hours: "text-muted-foreground",
    spent_hours: "text-muted-foreground",
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {canCreateIssue && (
          <CreateIssueDialog
            client={client}
            projects={creatableProjects}
            defaultProjectId={selectedProjectId}
            currentUser={user}
            baseUrl={baseUrl}
            onCreated={(issue) => navigate(`/issues/${issue.id}`)}
            trigger={
              <Button size="sm" className="gap-1.5">
                <Plus className="size-3.5" />
                Добавить задачу
              </Button>
            }
          />
        )}

        <Select
          value={assignee}
          disabled={queryId !== null}
          onValueChange={(v) => setAssignee(v as typeof assignee)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="me">Мои задачи</SelectItem>
            <SelectItem value="all">Все исполнители</SelectItem>
          </SelectContent>
        </Select>

        {layout === "table" && (
          <Select
            value={status}
            disabled={queryId !== null}
            onValueChange={(v) => setStatus(v as typeof status)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Открытые</SelectItem>
              <SelectItem value="closed">Закрытые</SelectItem>
              <SelectItem value="all">Все статусы</SelectItem>
            </SelectContent>
          </Select>
        )}

        {layout === "table" && queries.length > 0 && (
          <Select
            value={queryId === null ? NO_QUERY : String(queryId)}
            onValueChange={(v) => setQueryId(v === NO_QUERY ? null : Number(v))}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_QUERY}>Без Query Redmine</SelectItem>
              {queries.map((q) => (
                <SelectItem key={q.id} value={String(q.id)}>
                  {q.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex items-center rounded-lg border border-border p-0.5">
          <Button
            size="icon-sm"
            variant={layout === "table" ? "secondary" : "ghost"}
            aria-label="Таблица"
            aria-pressed={layout === "table"}
            onClick={() => setLayout("table")}
          >
            <List className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant={layout === "kanban" ? "secondary" : "ghost"}
            aria-label="Канбан-доска"
            aria-pressed={layout === "kanban"}
            onClick={() => setLayout("kanban")}
          >
            <Kanban className="size-3.5" />
          </Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Bookmark className="size-3.5" />
              Виды
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {views.length === 0 && (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                Сохраненных видов пока нет
              </div>
            )}
            {views.map((view) => (
              <DropdownMenuItem
                key={view.id}
                onSelect={() => applyView(view)}
                className="justify-between gap-2"
              >
                {view.name}
                <button
                  type="button"
                  aria-label={`Удалить вид «${view.name}»`}
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(view.id);
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <SaveViewDialog
              onSave={(name) => save(name, filters)}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  Сохранить текущий вид...
                </DropdownMenuItem>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>

        {layout === "table" && (
          <IssueFilterPanel
            value={advanced}
            onChange={setAdvanced}
            trackers={trackers}
            priorities={priorities}
            versions={versions}
            members={members}
            projectSelected={selectedProjectId !== null}
            disabled={queryId !== null}
          />
        )}

        {layout === "table" && (
          <ListColumnSettings
            prefs={columnPrefs}
            onChange={setColumnPrefs}
          />
        )}

        {layout === "kanban" && selectedProjectId !== null && (
          <KanbanColumnSettings
            statuses={statuses}
            prefs={kanbanColumnPrefs}
            onChange={setKanbanColumnPrefs}
          />
        )}
      </div>

      {layout === "table" && queryId === null && (
        <ActiveFilterChips
          value={advanced}
          onChange={setAdvanced}
          trackers={trackers}
          priorities={priorities}
          versions={versions}
          members={members}
        />
      )}

      {layout === "table" && queryId !== null && (
        <p className="text-sm text-muted-foreground">
          Применен Query Redmine - фильтры исполнителя, статуса и проекта
          (в шапке) игнорируются, задаются самим query.
        </p>
      )}

      {layout === "table" && error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {inlineError && (
        <Alert variant="destructive">
          <AlertDescription>{inlineError}</AlertDescription>
        </Alert>
      )}

      {layout === "table" && selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          busy={bulkBusy}
          progress={bulkProgress}
          statuses={statuses}
          members={members}
          versions={versions}
          projectScoped={selectedProjectId !== null}
          canDelete={can("delete_issues", selectedProjectId)}
          onSetStatus={(statusId) =>
            runBulkAction((id) => updateIssue(client!, id, { statusId }))
          }
          onSetAssignee={(userId) =>
            runBulkAction((id) =>
              updateIssue(client!, id, { assignedToId: userId }),
            )
          }
          onSetVersion={(versionId) =>
            runBulkAction((id) =>
              updateIssue(client!, id, { fixedVersionId: versionId }),
            )
          }
          onWatchMe={() =>
            user &&
            runBulkAction((id) => addWatcher(client!, id, user.id))
          }
          onDelete={() => setBulkDeleteOpen(true)}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {bulkResult && (
        <Alert
          variant={bulkResult.failed.length > 0 ? "destructive" : "default"}
        >
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{summarizeBulk(bulkResult)}</span>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => setBulkResult(null)}
            >
              Ок
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {layout === "kanban" &&
        (selectedProjectId === null ? (
          <div className="rounded-lg border border-border bg-card py-8 text-center text-muted-foreground">
            Канбан показывает статусы одного проекта - выберите проект в шапке.
          </div>
        ) : (
          <KanbanBoard
            client={client}
            projectId={selectedProjectId}
            assignee={assignee}
            canEdit={can("edit_issues", selectedProjectId)}
            columnPrefs={kanbanColumnPrefs}
          />
        ))}

      {layout === "table" && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-9">
                  <input
                    type="checkbox"
                    className="size-4 cursor-pointer accent-primary align-middle"
                    aria-label="Выбрать все"
                    checked={
                      issues.length > 0 && selectedIds.size === issues.length
                    }
                    ref={(el) => {
                      if (el)
                        el.indeterminate =
                          selectedIds.size > 0 &&
                          selectedIds.size < issues.length;
                    }}
                    onChange={toggleSelectAll}
                  />
                </TableHead>
                {visibleCols.map((col) => (
                  <TableHead key={col.id} className={col.cellClass}>
                    {col.sortField ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.sortField!)}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        {col.label}
                        {sortField === col.sortField &&
                          (sortDir === "desc" ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <ArrowUp className="size-3.5" />
                          ))}
                      </button>
                    ) : (
                      col.label
                    )}
                  </TableHead>
                ))}
                <TableHead className="hidden w-9 sm:table-cell" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={visibleCols.length + 2}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))}

              {!isLoading && issues.length === 0 && !error && (
                <TableRow>
                  <TableCell colSpan={visibleCols.length + 2}>
                    <EmptyState
                      size="default"
                      title="Задач по этим фильтрам не найдено"
                    />
                  </TableCell>
                </TableRow>
              )}

              {!isLoading &&
                issues.map((issue, i) => (
                  <TableRow
                    key={issue.id}
                    ref={i === navIndex ? setNavActiveRef : undefined}
                    // animate-in fade-in-0 - при смене фильтров новые
                    // issue.id монтируются как новые строки и плавно
                    // проявляются (issue #9, "переходы между состояниями
                    // списков при фильтрации"); уже показанные строки не
                    // перемонтируются на каждый рендер, так что анимация не
                    // дёргается зря. motion-reduce - см. index.css.
                    className={cn(
                      "relative cursor-pointer animate-in fade-in-0 duration-200 hover:bg-accent/50 motion-reduce:animate-none",
                      i === navIndex && "bg-accent",
                      selectedIds.has(issue.id) && "bg-primary/5",
                    )}
                  >
                    <TableCell className="w-9">
                      <input
                        type="checkbox"
                        className="relative z-10 size-4 cursor-pointer accent-primary align-middle"
                        aria-label={`Выбрать задачу #${issue.id}`}
                        checked={selectedIds.has(issue.id)}
                        onChange={() => toggleSelected(issue.id)}
                      />
                    </TableCell>
                    {visibleCols.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn(col.cellClass, COL_BODY_CLASS[col.id])}
                        title={
                          col.id === "updated_on"
                            ? fullTimestamp(issue.updated_on)
                            : undefined
                        }
                      >
                        {renderCell(col, issue)}
                      </TableCell>
                    ))}
                    <TableCell className="hidden sm:table-cell">
                      {baseUrl && (
                        <a
                          href={issueUrl(baseUrl, issue.id)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Tauri webview не открывает системный браузер
                            // сам - issue #24.
                            if (isTauri()) {
                              e.preventDefault();
                              openExternal(issueUrl(baseUrl, issue.id));
                            }
                          }}
                          className="relative z-10 text-muted-foreground hover:text-foreground"
                          aria-label="Открыть в Redmine"
                          title="Открыть в Redmine"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}

      {layout === "table" && !isLoading && issues.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Показано {issues.length} из {totalCount}
          </span>
          {hasMore && (
            <Button
              variant="outline"
              size="sm"
              onClick={loadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore && <Loader2 className="size-3.5 animate-spin" />}
              Показать еще
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Удалить задач: ${selectedIds.size}?`}
        description="Действие необратимо. Задачи без прав на удаление останутся - будет показана сводка."
        onConfirm={async () => {
          setBulkDeleteOpen(false);
          await runBulkAction((id) => deleteIssue(client!, id));
        }}
      />
    </div>
  );
}
