import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
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
import { useAuth } from "@/contexts/AuthContext";
import { listIssues, type IssueSummary } from "@/api/issues";
import { createTimeEntry, type TimeEntryInput } from "@/api/timeEntries";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { WeeklyTimeDebtWidget } from "@/components/time/WeeklyTimeDebtWidget";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { useProjects } from "@/hooks/useProjects";
import { useTimeEntryActivities } from "@/hooks/useTimeEntryActivities";
import { useLayoutContext } from "./AppLayout";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

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
  const { client } = useAuth();
  const { selectedProjectId } = useLayoutContext();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [recent, setRecent] = useState<IssueSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activity = useActivityFeed(client, selectedProjectId ?? undefined);
  const { projects } = useProjects(client);
  const { activities } = useTimeEntryActivities(client);

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
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Загрузка...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <WeeklyTimeDebtWidget
        client={client}
        projects={projects}
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Мои открытые задачи" value={counts.myOpen} />
          <StatCard label="Все открытые задачи" value={counts.allOpen} />
          <StatCard label="Мои задачи всего" value={counts.myTotal} />
          <StatCard label="Закрыто" value={counts.allClosed} />
        </div>
      )}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Недавно обновленные мои задачи</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {recent.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">
              Открытых задач на вас не найдено
            </p>
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
                        <Badge variant={issue.status.is_closed ? "secondary" : "default"}>
                          {issue.status.name}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(issue.updated_on)}
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
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Загрузка...
            </div>
          ) : (
            <ActivityFeed entries={activity.entries} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
