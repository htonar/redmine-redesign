import { Square, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDuration } from "@/lib/format-duration";
import type { TimerState } from "@/lib/timer-storage";

export interface TimerIndicatorProps {
  timer: TimerState;
  elapsedMs: number;
  /** Стоп: открыть диалог создания записи с наработкой. */
  onStop: () => void;
  /** Сбросить без создания записи. */
  onCancel: () => void;
}

/**
 * Пилюля активного таймера в Topbar (issue #34) - задача, счётчик вверх,
 * стоп -> диалог, крестик -> сброс.
 */
export function TimerIndicator({
  timer,
  elapsedMs,
  onStop,
  onCancel,
}: TimerIndicatorProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1.5 py-1">
      <Timer className="size-3.5 shrink-0 text-primary" />
      <span
        className="hidden max-w-[10rem] truncate text-xs text-muted-foreground sm:inline"
        title={`#${timer.issueId} ${timer.issueSubject}`}
      >
        #{timer.issueId}
      </span>
      <span className="min-w-[3.5rem] text-center font-mono text-xs tabular-nums">
        {formatDuration(elapsedMs)}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-6"
            aria-label="Остановить таймер и залогировать"
            onClick={onStop}
          >
            <Square className="size-3 fill-current" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Стоп - залогировать время</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-6 text-muted-foreground"
            aria-label="Сбросить таймер без записи"
            onClick={onCancel}
          >
            <X className="size-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Сбросить без записи</TooltipContent>
      </Tooltip>
    </div>
  );
}
