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
import { updateIssue, type IssueListFilters } from "@/api/issues";
import { parseSort, toggleSort as toggleSortValue } from "@/lib/issue-sort";
import { issueUrl } from "@/lib/redmine-url";
import { openExternal } from "@/lib/open-external";
import { cn } from "@/lib/utils";
import { useListKeyboardNav } from "@/hooks/useListKeyboardNav";
import { priorityTextClass, statusBadgeClass } from "@/lib/issue-visuals";
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

/**
 * `cellClass` прячет второстепенные колонки на узких экранах, чтобы таблица
 * не уезжала в горизонтальный скролл. ID / Тема / Статус видны всегда.
 */
const SORTABLE_COLUMNS: { field: string; label: string; cellClass?: string }[] = [
  { field: "id", label: "ID" },
  { field: "subject", label: "Тема" },
  { field: "tracker", label: "Трекер", cellClass: "hidden md:table-cell" },
  { field: "priority", label: "Приоритет", cellClass: "hidden sm:table-cell" },
  { field: "status", label: "Статус" },
  { field: "updated_on", label: "Обновлено", cellClass: "hidden lg:table-cell" },
];

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
                {SORTABLE_COLUMNS.map(({ field, label, cellClass }) => (
                  <TableHead key={field} className={cellClass}>
                    <button
                      type="button"
                      onClick={() => toggleSort(field)}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      {label}
                      {sortField === field &&
                        (sortDir === "desc" ? (
                          <ArrowDown className="size-3.5" />
                        ) : (
                          <ArrowUp className="size-3.5" />
                        ))}
                    </button>
                  </TableHead>
                ))}
                <TableHead className="hidden xl:table-cell">Проект</TableHead>
                <TableHead className="hidden lg:table-cell">Исполнитель</TableHead>
                <TableHead className="hidden w-9 sm:table-cell" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))}

              {!isLoading && issues.length === 0 && !error && (
                <TableRow>
                  <TableCell colSpan={9}>
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
                    )}
                  >
                    <TableCell className="text-muted-foreground">
                      {/* Растянутая ссылка на всю строку (issue #55): обычный
                          клик - SPA-переход, Ctrl/Cmd/средняя кнопка и
                          "Открыть в новой вкладке" работают нативно. */}
                      <Link
                        to={`/issues/${issue.id}`}
                        className="after:absolute after:inset-0 after:content-['']"
                        aria-label={`Открыть задачу #${issue.id}`}
                      >
                        #{issue.id}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[45vw] truncate font-medium sm:max-w-xs">
                      {issue.subject}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {issue.tracker?.name ?? "-"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "hidden font-medium sm:table-cell",
                        priorityTextClass(issue.priority?.name),
                      )}
                    >
                      {issue.priority?.name ?? "-"}
                    </TableCell>
                    <TableCell>
                      {can("edit_issues", issue.project?.id) &&
                      statuses.length > 0 ? (
                        <Select
                          value={String(issue.status?.id ?? "")}
                          disabled={inlineBusyId === issue.id}
                          onValueChange={(v) => {
                            const next = statuses.find(
                              (s) => String(s.id) === v,
                            );
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
                      ) : (
                        issue.status && (
                          <Badge
                            variant="outline"
                            className={statusBadgeClass(issue.status)}
                          >
                            {issue.status.name}
                          </Badge>
                        )
                      )}
                    </TableCell>
                    <TableCell
                      className="hidden text-muted-foreground lg:table-cell"
                      title={fullTimestamp(issue.updated_on)}
                    >
                      {formatRelativeTime(issue.updated_on)}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {issue.project?.name ?? "-"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {selectedProjectId &&
                      members.length > 0 &&
                      can("edit_issues", issue.project?.id) ? (
                        <Select
                          value={
                            issue.assigned_to
                              ? String(issue.assigned_to.id)
                              : UNASSIGNED
                          }
                          disabled={inlineBusyId === issue.id}
                          onValueChange={(v) => {
                            const nextId = v === UNASSIGNED ? null : Number(v);
                            if (nextId === (issue.assigned_to?.id ?? null)) return;
                            const prev = issue.assigned_to;
                            const nextMember = members.find(
                              (m) => m.id === nextId,
                            );
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
                            <SelectItem value={UNASSIGNED}>
                              Не назначено
                            </SelectItem>
                            {issue.assigned_to &&
                              !members.some(
                                (m) => m.id === issue.assigned_to!.id,
                              ) && (
                                <SelectItem
                                  value={String(issue.assigned_to.id)}
                                >
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
                      ) : (
                        (issue.assigned_to?.name ?? "-")
                      )}
                    </TableCell>
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
    </div>
  );
}
