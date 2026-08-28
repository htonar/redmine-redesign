import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
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
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/contexts/AuthContext";
import { listIssues, type IssueSummary } from "@/api/issues";
import { createTimeEntry, type TimeEntryInput } from "@/api/timeEntries";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { WeeklyTimeDebtWidget } from "@/components/time/WeeklyTimeDebtWidget";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { useProjects } from "@/hooks/useProjects";
import { useTimeEntryActivities } from "@/hooks/useTimeEntryActivities";
import { useIssueStatuses } from "@/hooks/useIssueStatuses";
import { useIssuePriorities } from "@/hooks/useIssuePriorities";
import { useTrackers } from "@/hooks/useTrackers";
import type { JournalValueMaps } from "@/lib/journal-format";
import { statusBadgeClass } from "@/lib/issue-visuals";
import { formatRelativeTime, fullTimestamp } from "@/lib/relative-time";
import { useLayoutContext } from "./AppLayout";

interface Counts {
  myOpen: number;
  allOpen: number;
  myTotal: number;
  allClosed: number;
}

/**
 * Обзорный дашборд: реальные счетчики задач + недавно обновленные мои задачи.
 * Учитывает текущий проект из Topbar, как и IssuesPage. См. CLAUDE.md.
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const { client, can, user } = useAuth();
  const { selectedProjectId } = useLayoutContext();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [recent, setRecent] = useState<IssueSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activity = useActivityFeed(client, selectedProjectId ?? undefined);
  const { projects } = useProjects(client);
  const { activities } = useTimeEntryActivities(client);
  const { statuses } = useIssueStatuses(client);
  const { priorities } = useIssuePriorities(client);
  const { trackers } = useTrackers(client);

  // Карты id -> имя для истории в ленте активности (issue #30): без них
  // ActivityFeed показывал `Исполнитель: — → 1` и т.п. вместо имён.
  // status/priority/tracker - глобальные справочники; assigned_to - лента
  // "по своим задачам", так что почти всегда "→ я", хотя бы это резолвим.
  const journalValueMaps: JournalValueMaps = useMemo(
    () => ({
      status_id: Object.fromEntries(statuses.map((s) => [s.id, s.name])),
      priority_id: Object.fromEntries(priorities.map((p) => [p.id, p.name])),
      tracker_id: Object.fromEntries(trackers.map((t) => [t.id, t.name])),
      assigned_to_id: user
        ? { [user.id]: `${user.firstname} ${user.lastname}`.trim() }
        : {},
    }),
    [statuses, priorities, trackers, user],
  );
  // log_time - право за проект, виджету передаем уже отфильтрованный список
  // (см. TimeTrackingPage.tsx - тот же паттерн).
  const loggableProjects = useMemo(
    () => projects.filter((p) => can("log_time", p.id)),
    [projects, can],
  );

  async function handleLogTime(input: TimeEntryInput) {
    if (!client) return;
    await createTimeEntry(client, input);
  }

  useEffect(() => {
    if (!client) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const projectId = selectedProjectId ?? undefined;
    const base = { projectId, sort: "updated_on:desc" as const };

    Promise.all([
      listIssues(client, { ...base, assignee: "me", status: "open", offset: 0, limit: 1 }),
      listIssues(client, { ...base, assignee: "all", status: "open", offset: 0, limit: 1 }),
      listIssues(client, { ...base, assignee: "me", status: "all", offset: 0, limit: 1 }),
      listIssues(client, { ...base, assignee: "all", status: "closed", offset: 0, limit: 1 }),
      listIssues(client, { ...base, assignee: "me", status: "open", offset: 0, limit: 5 }),
    ])
      .then(([myOpen, allOpen, myTotal, allClosed, recentIssues]) => {
        if (cancelled) return;
        setCounts({
          myOpen: myOpen.totalCount,
          allOpen: allOpen.totalCount,
          myTotal: myTotal.totalCount,
          allClosed: allClosed.totalCount,
        });
        setRecent(recentIssues.issues);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Не удалось загрузить дашборд.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, selectedProjectId]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Недавно обновленные мои задачи</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 px-4 py-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <WeeklyTimeDebtWidget
        client={client}
        projects={loggableProjects}
        activities={activities}
        defaultProjectId={selectedProjectId}
        onLogTime={handleLogTime}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {counts && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Мои открытые задачи"
            value={counts.myOpen}
            to="/issues?assignee=me&status=open"
          />
          <StatCard
            label="Все открытые задачи"
            value={counts.allOpen}
            to="/issues?assignee=all&status=open"
          />
          <StatCard
            label="Мои задачи всего"
            value={counts.myTotal}
            to="/issues?assignee=me&status=all"
          />
          <StatCard
            label="Закрыто"
            value={counts.allClosed}
            to="/issues?assignee=all&status=closed"
          />
        </div>
      )}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Недавно обновленные мои задачи</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {recent.length === 0 ? (
            <EmptyState title="Открытых задач на вас не найдено" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Тема</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Обновлено</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((issue) => (
                  <TableRow
                    key={issue.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/issues/${issue.id}`)}
                  >
                    <TableCell className="text-muted-foreground">#{issue.id}</TableCell>
                    <TableCell className="max-w-xs truncate font-medium">
                      {issue.subject}
                    </TableCell>
                    <TableCell>
                      {issue.status && (
                        <Badge
                          variant="outline"
                          className={statusBadgeClass(issue.status)}
                        >
                          {issue.status.name}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground"
                      title={fullTimestamp(issue.updated_on)}
                    >
                      {formatRelativeTime(issue.updated_on)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Активность</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {activity.error ? (
            <Alert variant="destructive" className="mx-4 my-4">
              <AlertDescription>{activity.error}</AlertDescription>
            </Alert>
          ) : activity.isLoading ? (
            <div className="flex flex-col gap-2 px-4 py-4">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          ) : (
            <ErrorBoundary title="Не удалось отобразить ленту активности">
              <ActivityFeed
                entries={activity.entries}
                valueMaps={journalValueMaps}
              />
            </ErrorBoundary>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
