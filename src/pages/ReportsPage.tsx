import { useMemo, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { ReportPeriodControl } from "@/components/reports/ReportPeriodControl";
import { useAuth } from "@/contexts/AuthContext";
import { useIssueReport } from "@/hooks/useIssueReport";
import { useTimeReport } from "@/hooks/useTimeReport";
import { useIssueSummaries } from "@/hooks/useIssueSummaries";
import type { ReportBucket } from "@/lib/issue-report";
import type { TimeReportRow } from "@/lib/time-report";
import { issueIdsFromReport } from "@/lib/time-report";
import { issueReportToCsv } from "@/lib/issue-report-csv";
import { timeReportToCsv } from "@/lib/time-report-csv";
import { statusBarClass } from "@/lib/issue-visuals";
import { resolveReportPeriod, type ReportPeriodValue } from "@/lib/report-period";
import { CSV_BOM } from "@/lib/csv";
import { saveBlobAs } from "@/lib/save-file";
import { useLayoutContext } from "./AppLayout";

interface BarRow {
  label: string;
  /** Число справа (count задач / часы). */
  value: number;
  /** Ширина бара, 0..1. */
  fraction: number;
  barClass: string;
}

function BreakdownCard({
  title,
  rows,
  valueSuffix,
}: {
  title: string;
  rows: BarRow[];
  valueSuffix?: string;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Нет данных
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((row) => (
              <div key={row.label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-foreground">{row.label}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {row.value}
                    {valueSuffix}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className={`h-full rounded-full ${row.barClass}`}
                    style={{ width: `${Math.max(row.fraction * 100, 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function bucketRows(
  buckets: ReportBucket[],
  barClassOf: (b: ReportBucket) => string,
): BarRow[] {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return buckets.map((b) => ({
    label: b.label,
    value: b.count,
    fraction: b.count / max,
    barClass: barClassOf(b),
  }));
}

function timeRows(rows: TimeReportRow[], resolveLabel?: (r: TimeReportRow) => string): BarRow[] {
  const max = Math.max(0.01, ...rows.map((r) => r.hours));
  return rows.map((r) => ({
    label: resolveLabel ? resolveLabel(r) : r.label,
    value: r.hours,
    fraction: r.hours / max,
    barClass: "bg-primary/70",
  }));
}

/**
 * Раздел «Отчёты»: разбивки по задачам + отчёт по трудозатратам (issue #57),
 * общий фильтр периода (issue #58), осмысленные цвета баров (issue #59).
 * Только для одного выбранного в Topbar проекта - по аналогии с FilesPage.
 */
export function ReportsPage() {
  const { client } = useAuth();
  const { selectedProjectId } = useLayoutContext();
  const [period, setPeriod] = useState<ReportPeriodValue>({ preset: "all" });
  const resolved = useMemo(() => resolveReportPeriod(period), [period]);
  const range = { from: resolved.from, to: resolved.to };

  const issueReport = useIssueReport(client, selectedProjectId, range);
  const timeReport = useTimeReport(client, selectedProjectId, range);

  const timeIssueIds = useMemo(
    () => (timeReport.report ? issueIdsFromReport(timeReport.report) : []),
    [timeReport.report],
  );
  const issueSummaries = useIssueSummaries(client, timeIssueIds);
  const resolveIssueLabel = (r: TimeReportRow) => {
    if (!r.key.startsWith("issue-")) return r.label;
    const id = Number(r.key.slice(6));
    const subject = issueSummaries[id]?.subject;
    return subject ? `#${id} ${subject}` : `#${id}`;
  };

  if (!selectedProjectId) {
    return (
      <div className="rounded-lg border border-border bg-card py-8 text-center text-muted-foreground">
        Выберите проект в шапке, чтобы увидеть отчёты по нему.
      </div>
    );
  }

  function exportIssues() {
    if (!issueReport.report) return;
    const csv = CSV_BOM + issueReportToCsv(issueReport.report);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const today = new Date().toISOString().slice(0, 10);
    saveBlobAs(blob, `report-issues-${selectedProjectId}-${today}.csv`);
  }

  function exportTime() {
    if (!timeReport.report) return;
    const csv =
      CSV_BOM + timeReportToCsv(timeReport.report, resolveIssueLabel);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const today = new Date().toISOString().slice(0, 10);
    saveBlobAs(blob, `report-time-${selectedProjectId}-${today}.csv`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Отчёты</h1>
        <ReportPeriodControl value={period} onChange={setPeriod} />
      </div>

      <Tabs defaultValue="issues">
        <TabsList>
          <TabsTrigger value="issues">Задачи</TabsTrigger>
          <TabsTrigger value="time">Время</TabsTrigger>
        </TabsList>

        <TabsContent value="issues" className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={exportIssues}
              disabled={!issueReport.report || issueReport.isLoading}
            >
              <Download className="size-3.5" />
              Экспорт в CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="ml-2 gap-1.5"
              onClick={issueReport.reload}
              disabled={issueReport.isLoading}
            >
              <RefreshCw className="size-3.5" />
              Обновить
            </Button>
          </div>

          {issueReport.error && (
            <Alert variant="destructive">
              <AlertDescription>{issueReport.error}</AlertDescription>
            </Alert>
          )}

          {issueReport.isLoading && (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Загрузка...
            </div>
          )}

          {!issueReport.isLoading && !issueReport.error && issueReport.report && (
            <>
              {issueReport.isCapped && (
                <Alert>
                  <AlertDescription>
                    В проекте больше задач, чем удалось загрузить - показана
                    сводка по первым {issueReport.report.total}.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Всего задач" value={issueReport.report.total} />
                <StatCard label="Открыто" value={issueReport.report.openCount} />
                <StatCard label="Закрыто" value={issueReport.report.closedCount} />
              </div>

              {issueReport.report.total === 0 ? (
                <div className="rounded-lg border border-border bg-card py-8 text-center text-muted-foreground">
                  Нет задач за выбранный период
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <BreakdownCard
                    title="По трекеру"
                    rows={bucketRows(
                      issueReport.report.byTracker,
                      () => "bg-primary/70",
                    )}
                  />
                  <BreakdownCard
                    title="По статусу"
                    rows={bucketRows(issueReport.report.byStatus, (b) =>
                      statusBarClass({ name: b.label, is_closed: b.isClosed }),
                    )}
                  />
                  <BreakdownCard
                    title="По версии"
                    rows={bucketRows(
                      issueReport.report.byVersion,
                      () => "bg-primary/70",
                    )}
                  />
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="time" className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={exportTime}
              disabled={!timeReport.report || timeReport.isLoading}
            >
              <Download className="size-3.5" />
              Экспорт в CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="ml-2 gap-1.5"
              onClick={timeReport.reload}
              disabled={timeReport.isLoading}
            >
              <RefreshCw className="size-3.5" />
              Обновить
            </Button>
          </div>

          {timeReport.error && (
            <Alert variant="destructive">
              <AlertDescription>{timeReport.error}</AlertDescription>
            </Alert>
          )}

          {timeReport.isLoading && (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Загрузка...
            </div>
          )}

          {!timeReport.isLoading && !timeReport.error && timeReport.report && (
            <>
              {timeReport.isCapped && (
                <Alert>
                  <AlertDescription>
                    Записей времени больше, чем удалось загрузить - показана
                    часть.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <StatCard
                  label={`Всего часов${resolved.label === "Всё время" ? "" : ` (${resolved.label})`}`}
                  value={timeReport.report.totalHours.toFixed(2)}
                />
                <StatCard label="Записей" value={timeReport.report.entryCount} />
              </div>

              {timeReport.report.entryCount === 0 ? (
                <div className="rounded-lg border border-border bg-card py-8 text-center text-muted-foreground">
                  Нет записей времени за выбранный период
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <BreakdownCard
                    title="По задачам"
                    valueSuffix=" ч"
                    rows={timeRows(
                      timeReport.report.byIssue,
                      resolveIssueLabel,
                    )}
                  />
                  <BreakdownCard
                    title="По исполнителям"
                    valueSuffix=" ч"
                    rows={timeRows(timeReport.report.byUser)}
                  />
                  <BreakdownCard
                    title="По видам деятельности"
                    valueSuffix=" ч"
                    rows={timeRows(timeReport.report.byActivity)}
                  />
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
