import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
} from "lucide-react";
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
  // Выходной: нормы нет, столбик нейтральный, "+" не показываем.
  const met = !day.isFuture && !day.isWeekend && day.deficit === 0;
  const rawPct = day.isFuture
    ? 0
    : Math.min(100, (day.hoursLogged / DAILY_TARGET_HOURS) * 100);
  // Минимальная видимая полоска для прошедшего буднего дня с почти нулевым
  // логом - иначе столбик выглядит сломанным, а не "ничего не затрекано".
  const fillPct =
    !day.isFuture && !day.isWeekend && rawPct < 4 ? 4 : rawPct;
  const showAddButton =
    !day.isFuture && !day.isWeekend && day.deficit > 0 && projects.length > 0;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          // Дорожка - foreground/10, тот же прием, что и в Progress (см.
          // progress.tsx) для фикса той же проблемы: bg-muted/60 и
          // success|warning/15 почти сливались с фоном карточки в тёмной
          // теме (обе близкие темные тона в этой палитре) - на 0ч
          // залогированного дня дорожка была практически невидима, только
          // подпись "0.0ч" намекала, что тут вообще есть столбик (найдено
          // на аудите тёмной темы, GitHub issue #10).
          // after: базовая линия по низу - дорожка читается как ось графика,
          // а не как наполовину пустой «сломанный» столбик (issue #51).
          "relative flex w-9 items-end overflow-hidden rounded-t-md bg-foreground/10 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-border",
          day.isFuture && "opacity-50",
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
            className={cn(
              "w-full rounded-t-md transition-all",
              day.isWeekend
                ? "bg-muted-foreground/50"
                : met
                  ? "bg-success"
                  : "bg-warning",
            )}
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

      {/* Слот под "+" фиксированной высоты всегда - иначе колонки с кнопкой
          выше остальных и вся строка (flex items-end) едет по вертикали. */}
      <div className="flex h-5 items-center">
        {showAddButton && (
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
    </div>
  );
}

export interface WeeklyTimeDebtWidgetProps {
  client: RedmineClient | null;
  /**
   * Ожидается уже отфильтрованным по праву log_time (см. вызывающий код в
   * TimeTrackingPage.tsx/DashboardPage.tsx) - виджет сам прав не проверяет,
   * пустой список значит "нигде залогировать время нельзя", кнопка "+"
   * скрывается.
   */
  projects: Project[];
  activities: TimeEntryActivity[];
  defaultProjectId?: number | null;
  onLogTime: (input: TimeEntryInput) => Promise<void>;
  /**
   * Управляемое смещение недели (issue #64): когда задано, виджет не рисует
   * свои ◀/▶ - неделей рулит контрол периода на странице учёта времени.
   * Не задано (дашборд) - виджет сам по себе, со своими стрелками.
   */
  weekOffset?: number;
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
  weekOffset: controlledWeekOffset,
}: WeeklyTimeDebtWidgetProps) {
  const [ownWeekOffset, setOwnWeekOffset] = useState(0);
  const controlled = controlledWeekOffset !== undefined;
  const weekOffset = controlled ? controlledWeekOffset : ownWeekOffset;
  const { days, totalDeficit, rangeLabel, isLoading, error, reload } =
    useWeeklyTimeDebt(client, weekOffset);

  async function handleLogTime(input: TimeEntryInput) {
    await onLogTime(input);
    reload();
  }

  // Выходные показываем, только если в них есть залогированное время -
  // иначе не засоряем виджет пустыми Сб/Вс (issue #35).
  const visibleDays = days.filter((d) => !d.isWeekend || d.hoursLogged > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b">
        <CardTitle>
          {weekOffset === 0 ? "Трудозатраты на этой неделе" : "Трудозатраты за неделю"}
        </CardTitle>
        {controlled ? (
          <span className="text-xs text-muted-foreground">{rangeLabel}</span>
        ) : (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Предыдущая неделя"
              onClick={() => setOwnWeekOffset((o) => o - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-28 text-center text-xs">{rangeLabel}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Следующая неделя"
              disabled={weekOffset >= 0}
              onClick={() => setOwnWeekOffset((o) => o + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
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
              {visibleDays.map((day) => (
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
