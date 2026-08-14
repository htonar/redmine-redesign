import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  ChevronDown,
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
import { useAuth } from "@/contexts/AuthContext";
import { useIssues } from "@/hooks/useIssues";
import { useIssueViews } from "@/hooks/useIssueViews";
import { useProjects } from "@/hooks/useProjects";
import { useQueries } from "@/hooks/useQueries";
import type { IssueListFilters } from "@/api/issues";
import { parseSort, toggleSort as toggleSortValue } from "@/lib/issue-sort";
import type { IssueView } from "@/lib/issue-views-storage";
import { useLayoutContext } from "./AppLayout";

const DEFAULT_FILTERS: Pick<IssueListFilters, "assignee" | "status" | "sort"> =
  {
    assignee: "me",
    status: "open",
    sort: "updated_on:desc",
  };

/** Сентинел для пункта "без query" в Select - Radix Select не допускает value="". */
const NO_QUERY = "__none__";

const SORTABLE_COLUMNS: { field: string; label: string }[] = [
  { field: "id", label: "ID" },
  { field: "subject", label: "Тема" },
  { field: "tracker", label: "Трекер" },
  { field: "priority", label: "Приоритет" },
  { field: "status", label: "Статус" },
  { field: "updated_on", label: "Обновлено" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Список задач: фильтры (проект - в Topbar, исполнитель, статус), сортировка,
 * сохраненные виды. Дефолт - "мои открытые задачи", см. CLAUDE.md раздел
 * "Список задач: фильтры, сортировка, сохраненные виды".
 */
export function IssuesPage() {
  const navigate = useNavigate();
  const { client, baseUrl, user, can } = useAuth();
  const { selectedProjectId, setSelectedProjectId } = useLayoutContext();
  const [assignee, setAssignee] = useState<IssueListFilters["assignee"]>(
    DEFAULT_FILTERS.assignee,
  );
  const [status, setStatus] = useState<IssueListFilters["status"]>(
    DEFAULT_FILTERS.status,
  );
  const [sort, setSort] = useState(DEFAULT_FILTERS.sort);
  // Нативный Query Redmine (issue #14) - когда выбран, Redmine игнорирует
  // остальные фильтры на сервере (project/assignee/status), поэтому UI их
  // дизейблит, а не позволяет думать, что они применяются одновременно.
  const [queryId, setQueryId] = useState<number | null>(null);
  // Не "view" - это имя уже занято переменной цикла для сохраненных видов (IssueView) ниже.
  const [layout, setLayout] = useState<"table" | "kanban">("table");

  const filters: IssueListFilters = {
    projectId: selectedProjectId ?? undefined,
    assignee,
    status,
    sort,
    queryId: queryId ?? undefined,
  };

  const {
    issues,
    totalCount,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
  } = useIssues(client, filters);
  const { views, save, remove } = useIssueViews(baseUrl, user?.id);
  const { projects } = useProjects(client);
  const { queries } = useQueries(client);

  const { field: sortField, dir: sortDir } = parseSort(sort);

  function toggleSort(field: string) {
    setSort(toggleSortValue(sort, field));
  }

  function applyView(view: IssueView) {
    setAssignee(view.filters.assignee);
    setStatus(view.filters.status);
    setSort(view.filters.sort);
    setSelectedProjectId(view.filters.projectId ?? null);
    setQueryId(view.filters.queryId ?? null);
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
      </div>

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
          />
        ))}

      {layout === "table" && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {SORTABLE_COLUMNS.map(({ field, label }) => (
                  <TableHead key={field}>
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
                <TableHead>Проект</TableHead>
                <TableHead>Исполнитель</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))}

              {!isLoading && issues.length === 0 && !error && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState
                      size="default"
                      title="Задач по этим фильтрам не найдено"
                    />
                  </TableCell>
                </TableRow>
              )}

              {!isLoading &&
                issues.map((issue) => (
                  <TableRow
                    key={issue.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/issues/${issue.id}`)}
                  >
                    <TableCell className="text-muted-foreground">
                      #{issue.id}
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-medium">
                      {issue.subject}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {issue.tracker?.name ?? "-"}
                    </TableCell>
                    <TableCell>{issue.priority?.name ?? "-"}</TableCell>
                    <TableCell>
                      {issue.status && (
                        <Badge
                          variant={
                            issue.status.is_closed ? "secondary" : "default"
                          }
                        >
                          {issue.status.name}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(issue.updated_on)}
                    </TableCell>
                    <TableCell>{issue.project?.name ?? "-"}</TableCell>
                    <TableCell>{issue.assigned_to?.name ?? "-"}</TableCell>
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
