import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LogTimeDialog, type LogTimeDialogInitial } from "@/components/time/LogTimeDialog";
import { WeeklyTimeDebtWidget } from "@/components/time/WeeklyTimeDebtWidget";
import { useAuth } from "@/contexts/AuthContext";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useProjects } from "@/hooks/useProjects";
import { useIssueSummaries } from "@/hooks/useIssueSummaries";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { useTimeEntryActivities } from "@/hooks/useTimeEntryActivities";
import {
  createTimeEntry,
  deleteTimeEntry,
  updateTimeEntry,
  type TimeEntry,
  type TimeEntryInput,
  type TimeEntryListFilters,
} from "@/api/timeEntries";
import { canManageTimeEntry } from "@/lib/time-entry-permissions";
import { timeEntriesToCsv } from "@/lib/time-entries-csv";
import { CSV_BOM } from "@/lib/csv";
import { saveBlobAs } from "@/lib/save-file";
import {
  resolvePeriod,
  widgetWeekOffset,
  type PeriodUnit,
} from "@/lib/time-period";
import { useLayoutContext } from "./AppLayout";

const UNIT_OPTIONS: { value: PeriodUnit; label: string }[] = [
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "all", label: "Всё время" },
];

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatGroupDate(iso: string): string {
  const label = parseIsoDate(iso).toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface DayGroup {
  date: string;
  entries: TimeEntry[];
  totalHours: number;
}

function groupByDay(entries: TimeEntry[]): DayGroup[] {
  const map = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.spent_on) ?? [];
    list.push(entry);
    map.set(entry.spent_on, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, dayEntries]) => ({
      date,
      entries: dayEntries,
      totalHours: dayEntries.reduce((sum, e) => sum + e.hours, 0),
    }));
}

function editInitial(entry: TimeEntry): LogTimeDialogInitial {
  return {
    issueId: entry.issue?.id,
    projectId: entry.project?.id,
    spentOn: entry.spent_on,
    hours: entry.hours,
    activityId: entry.activity?.id,
    comments: entry.comments ?? "",
  };
}

/**
 * Учет трудозатрат: просмотр записей (сгруппированы по дням) + быстрый ввод
 * времени. См. CLAUDE.md, раздел "Учет трудозатрат (time tracking)".
 * Правка/удаление своей записи - через PUT/DELETE, доступны прямо из таблицы.
 */
export function TimeTrackingPage() {
  const { client, baseUrl, user, can } = useAuth();
  const { selectedProjectId } = useLayoutContext();
  const { projects } = useProjects(client);
  const { activities } = useTimeEntryActivities(client);
  // log_time - право за проект, а не за страницу; LogTimeDialog сам содержит
  // выбор проекта, поэтому фильтруем список проектов, а не одну кнопку - см.
  // тот же паттерн для add_issues в IssuesPage.tsx/AppLayout.tsx.
  const loggableProjects = useMemo(
    () => projects.filter((p) => can("log_time", p.id)),
    [projects, can],
  );
  const [scope, setScope] = useState<TimeEntryListFilters["scope"]>("me");
  // Единый контрол периода (issue #64): единица + смещение, оба persisted.
  // Тот же период применяется и к списку записей, и к виджету долга.
  const [periodUnit, setPeriodUnit] = usePersistedState<PeriodUnit>(
    baseUrl,
    user?.id,
    "time-period-unit",
    "week",
  );
  const [periodOffset, setPeriodOffset] = usePersistedState<number>(
    baseUrl,
    user?.id,
    "time-period-offset",
    0,
  );
  const [deleteTarget, setDeleteTarget] = useState<TimeEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const period = useMemo(
    () => resolvePeriod(periodUnit, periodOffset),
    [periodUnit, periodOffset],
  );

  const filters: TimeEntryListFilters = {
    scope,
    projectId: selectedProjectId ?? undefined,
    from: period.from,
    to: period.to,
  };

  function changeUnit(unit: PeriodUnit) {
    setPeriodUnit(unit);
    setPeriodOffset(0);
  }

  const { entries, totalCount, isLoading, isLoadingMore, error, hasMore, loadMore, reload } =
    useTimeEntries(client, filters);

  const groups = useMemo(() => groupByDay(entries), [entries]);
  // API отдает по записи только issue.id без темы - подтягиваем темы пачкой,
  // чтобы в таблице был человекочитаемый заголовок, а не голый "#123".
  const issueIds = useMemo(
    () =>
      Array.from(
        new Set(
          entries
            .map((e) => e.issue?.id)
            .filter((id): id is number => typeof id === "number"),
        ),
      ),
    [entries],
  );
  const issueSummaries = useIssueSummaries(client, issueIds);
  const loadedHours = useMemo(() => entries.reduce((sum, e) => sum + e.hours, 0), [entries]);

  async function handleCreate(input: TimeEntryInput) {
    if (!client) return;
    await createTimeEntry(client, input);
    reload();
  }

  async function handleUpdate(id: number, input: TimeEntryInput) {
    if (!client) return;
    await updateTimeEntry(client, id, input);
    reload();
  }

  async function handleDelete() {
    if (!client || !deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteTimeEntry(client, deleteTarget.id);
      setDeleteTarget(null);
      reload();
    } finally {
      setIsDeleting(false);
    }
  }

  function handleExport() {
    const csv = CSV_BOM + timeEntriesToCsv(entries);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const today = new Date().toISOString().slice(0, 10);
    saveBlobAs(blob, `time-entries-${scope}-${today}.csv`);
  }

  return (
    <div className="flex flex-col gap-4">
      <WeeklyTimeDebtWidget
        client={client}
        projects={loggableProjects}
        activities={activities}
        defaultProjectId={selectedProjectId}
        onLogTime={handleCreate}
        weekOffset={widgetWeekOffset(periodUnit, periodOffset)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="me">Мои записи</SelectItem>
              <SelectItem value="all">Все записи</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={periodUnit}
            onValueChange={(v) => changeUnit(v as PeriodUnit)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {periodUnit !== "all" && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Предыдущий период"
                onClick={() => setPeriodOffset((o) => o - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-32 text-center text-sm text-muted-foreground">
                {period.label}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Следующий период"
                disabled={periodOffset >= 0}
                onClick={() => setPeriodOffset((o) => o + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleExport}
            disabled={entries.length === 0}
          >
            <Download className="size-3.5" />
            Экспорт в CSV
          </Button>

          {loggableProjects.length > 0 && (
            <LogTimeDialog
              client={client}
              projects={loggableProjects}
              activities={activities}
              defaultProjectId={selectedProjectId}
              onSubmit={handleCreate}
              trigger={
                <Button size="sm" className="gap-1.5">
                  <Plus className="size-3.5" />
                  Залогировать время
                </Button>
              }
            />
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isLoading && entries.length > 0 && (
        <Card size="sm" className="w-fit">
          <CardContent className="flex items-baseline gap-2 px-4">
            <span className="text-2xl font-semibold tracking-tight">
              {loadedHours.toFixed(2)} ч
            </span>
            <span className="text-sm text-muted-foreground">
              {periodUnit === "all" ? "всего" : `итого за период (${period.label})`}
              {" · "}
              {entries.length}
              {hasMore ? ` из ${totalCount}` : ""} записей
            </span>
          </CardContent>
        </Card>
      )}

      {isLoading &&
        Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex items-center justify-between border-b">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-12" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2 px-4 py-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </CardContent>
          </Card>
        ))}

      {!isLoading && entries.length === 0 && !error && (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            size="default"
            title="Записей по этим фильтрам не найдено"
          />
        </div>
      )}

      {!isLoading &&
        groups.map((group) => (
          <Card key={group.date}>
            <CardHeader className="flex items-center justify-between border-b">
              <CardTitle>{formatGroupDate(group.date)}</CardTitle>
              <span className="text-sm text-muted-foreground">
                {group.totalHours.toFixed(2)} ч
              </span>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Задача / проект</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Вид деятельности
                    </TableHead>
                    <TableHead className="hidden md:table-cell">Комментарий</TableHead>
                    <TableHead className="text-right">Часы</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {entry.issue ? (
                          <>
                            <span className="text-muted-foreground">
                              #{entry.issue.id}
                            </span>{" "}
                            {issueSummaries[entry.issue.id]?.subject ?? ""}
                          </>
                        ) : (
                          (entry.project?.name ?? "-")
                        )}
                        {entry.issue && entry.project && (
                          <span className="ml-1.5 font-normal text-muted-foreground">
                            {entry.project.name}
                          </span>
                        )}
                        {entry.comments && (
                          <div className="truncate text-xs font-normal text-muted-foreground md:hidden">
                            {entry.comments}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {entry.activity?.name ?? "-"}
                      </TableCell>
                      <TableCell className="hidden max-w-xs truncate text-muted-foreground md:table-cell">
                        {entry.comments || "-"}
                      </TableCell>
                      <TableCell className="text-right">{entry.hours.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canManageTimeEntry(entry, user?.id, can) && (
                            <>
                              <LogTimeDialog
                                client={client}
                                projects={loggableProjects}
                                activities={activities}
                                initial={editInitial(entry)}
                                onSubmit={(input) => handleUpdate(entry.id, input)}
                                trigger={
                                  <Button variant="ghost" size="icon-sm" aria-label="Изменить запись">
                                    <Pencil className="size-3.5" />
                                  </Button>
                                }
                              />
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Удалить запись"
                                onClick={() => setDeleteTarget(entry)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

      {!isLoading && hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={isLoadingMore}>
            {isLoadingMore && <Loader2 className="size-3.5 animate-spin" />}
            Показать еще
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Удалить запись времени?"
        description={
          deleteTarget
            ? `${deleteTarget.hours} ч за ${deleteTarget.spent_on} - действие необратимо.`
            : undefined
        }
        onConfirm={handleDelete}
        isConfirming={isDeleting}
      />
    </div>
  );
}
