import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import { useIssueReport } from "@/hooks/useIssueReport";
import type { ReportBucket } from "@/lib/issue-report";
import { useLayoutContext } from "./AppLayout";

const CHART_COLOR_CLASSES = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

interface ReportBreakdownCardProps {
  title: string;
  buckets: ReportBucket[];
}

/**
 * Одна ось разбивки (трекер/статус/версия) - горизонтальные полосы, ширина
 * пропорциональна count/max в рамках своего списка. Подпись и число - прямо
 * на строке (легенда не нужна - см. dataviz-скилл: identity никогда не
 * только цветом), цвет - по кругу из уже существующих --chart-1..5 токенов
 * (src/index.css), фиксированный порядок в рамках рендера.
 */
function ReportBreakdownCard({ title, buckets }: ReportBreakdownCardProps) {
  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {buckets.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">Нет данных</div>
        ) : (
          <div className="flex flex-col gap-3">
            {buckets.map((bucket, i) => (
              <div key={bucket.label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{bucket.label}</span>
                  <span className="tabular-nums text-muted-foreground">{bucket.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className={`h-full rounded-full ${CHART_COLOR_CLASSES[i % CHART_COLOR_CLASSES.length]}`}
                    style={{ width: `${(bucket.count / max) * 100}%` }}
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

/**
 * Сводка по задачам текущего проекта - группировка на фронте поверх
 * GET /issues.json (нет отдельного summary-эндпоинта в Redmine REST API), см.
 * GitHub issue #13. Только для одного выбранного в Topbar проекта - по
 * аналогии с тем, как это уже решено для "Файлы" (FilesPage.tsx).
 */
export function ReportsPage() {
  const { client } = useAuth();
  const { selectedProjectId } = useLayoutContext();
  const { report, isCapped, isLoading, error, reload } = useIssueReport(
    client,
    selectedProjectId,
  );

  if (!selectedProjectId) {
    return (
      <div className="rounded-lg border border-border bg-card py-8 text-center text-muted-foreground">
        Выберите проект в шапке, чтобы увидеть отчёт по нему.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Отчёты</h1>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={reload} disabled={isLoading}>
          <RefreshCw className="size-3.5" />
          Обновить
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Загрузка...
        </div>
      )}

      {!isLoading && !error && report && (
        <>
          {isCapped && (
            <Alert>
              <AlertDescription>
                В проекте больше задач, чем удалось загрузить для отчёта - показана сводка по
                первым {report.total}.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Всего задач" value={report.total} />
            <StatCard label="Открыто" value={report.openCount} />
            <StatCard label="Закрыто" value={report.closedCount} />
          </div>

          {report.total === 0 ? (
            <div className="rounded-lg border border-border bg-card py-8 text-center text-muted-foreground">
              В этом проекте пока нет задач
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <ReportBreakdownCard title="По трекеру" buckets={report.byTracker} />
              <ReportBreakdownCard title="По статусу" buckets={report.byStatus} />
              <ReportBreakdownCard title="По версии" buckets={report.byVersion} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
