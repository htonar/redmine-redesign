import { AlertTriangle, Check, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LogTimeDialog } from "@/components/time/LogTimeDialog";
import { cn } from "@/lib/utils";
import { DAILY_TARGET_HOURS, useWeeklyTimeDebt, type DayDebt } from "@/hooks/useWeeklyTimeDebt";
import type { RedmineClient } from "@/api/client";
import type { Project } from "@/hooks/useProjects";
import type { TimeEntryActivity } from "@/hooks/useTimeEntryActivities";
import type { TimeEntryInput } from "@/api/timeEntries";

const BAR_HEIGHT_PX = 72;

interface DayBarProps {
  day: DayDebt;
  client: RedmineClient | null;
  projects: Project[];
  activities: TimeEntryActivity[];
  defaultProjectId?: number | null;
  onLogTime: (input: TimeEntryInput) => Promise<void>;
}

function DayBar({ day, client, projects, activities, defaultProjectId, onLogTime }: DayBarProps) {
  const met = !day.isFuture && day.deficit === 0;
  const fillPct = day.isFuture ? 0 : Math.min(100, (day.hoursLogged / DAILY_TARGET_HOURS) * 100);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          "relative flex w-9 items-end overflow-hidden rounded-t-md",
          day.isFuture ? "bg-muted/60" : met ? "bg-success/15" : "bg-warning/15",
        )}
        style={{ height: BAR_HEIGHT_PX }}
        role="img"
        aria-label={
          day.isFuture
            ? `${day.weekdayLabel}: ещё не наступил`
            : `${day.weekdayLabel}: залогировано ${day.hoursLogged.toFixed(1)} из ${DAILY_TARGET_HOURS} ч`
        }
      >
        {!day.isFuture && (
          <div
            className={cn("w-full rounded-t-md transition-all", met ? "bg-success" : "bg-warning")}
            style={{ height: `${fillPct}%` }}
          />
        )}
      </div>

      <div
        className={cn(
          "flex items-center gap-0.5 text-xs font-medium",
          day.isToday ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {day.weekdayLabel}
        {met && <Check className="size-3 text-success" />}
      </div>
      <div className="text-[11px] text-muted-foreground">
        {day.isFuture ? "—" : `${day.hoursLogged.toFixed(1)}ч`}
      </div>

      {!day.isFuture && day.deficit > 0 && (
        <LogTimeDialog
          client={client}
          projects={projects}
          activities={activities}
          defaultProjectId={defaultProjectId}
          defaultSpentOn={day.date}
          onSubmit={onLogTime}
          trigger={
            <Button
              size="icon-sm"
              variant="ghost"
              className="size-5"
              aria-label={`Залогировать время за ${day.date}`}
            >
              <Plus className="size-3" />
            </Button>
          }
        />
      )}
    </div>
  );
}

export interface WeeklyTimeDebtWidgetProps {
  client: RedmineClient | null;
  projects: Project[];
  activities: TimeEntryActivity[];
  defaultProjectId?: number | null;
  onLogTime: (input: TimeEntryInput) => Promise<void>;
}

/**
 * Наглядно: сколько часов за какие будние дни текущей недели ещё не
 * залогировано, при норме 8ч/день - см. CLAUDE.md, "Мини-виджет долга по
 * трудозатратам". Столбики - факт против нормы за день (met/warning/future),
 * не голые цифры; клик по "+" под недотрекованным днем открывает
 * LogTimeDialog с этой датой уже подставленной.
 */
export function WeeklyTimeDebtWidget({
  client,
  projects,
  activities,
  defaultProjectId,
  onLogTime,
}: WeeklyTimeDebtWidgetProps) {
  const { days, totalDeficit, isLoading, error, reload } = useWeeklyTimeDebt(client);

  async function handleLogTime(input: TimeEntryInput) {
    await onLogTime(input);
    reload();
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Трудозатраты на этой неделе</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Загрузка...
          </div>
        )}

        {!isLoading && !error && (
          <div className="flex flex-wrap items-end gap-6">
            <div className="flex flex-col gap-1 border-r border-border pr-6">
              <span className="text-xs text-muted-foreground">Осталось затрекать</span>
              {/* Текст - нейтральным цветом (см. dataviz-скилл: "text never wears
                  the data color"), статус несет отдельная цветная иконка рядом. */}
              {totalDeficit > 0 ? (
                <span className="flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
                  <AlertTriangle className="size-6 shrink-0 text-warning" />
                  {totalDeficit.toFixed(1)} ч
                </span>
              ) : (
                <span className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
                  <Check className="size-6 shrink-0 text-success" />
                  Всё затрекано
                </span>
              )}
            </div>

            <div className="flex items-end gap-3">
              {days.map((day) => (
                <DayBar
                  key={day.date}
                  day={day}
                  client={client}
                  projects={projects}
                  activities={activities}
                  defaultProjectId={defaultProjectId}
                  onLogTime={handleLogTime}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
