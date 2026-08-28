import { ArrowDown, ArrowUp, Columns3, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  EMPTY_KANBAN_PREFS,
  moveInArray,
  sortStatusesByOrder,
  toggleHidden,
  type KanbanColumnPrefs,
} from "@/lib/kanban-columns";
import { cn } from "@/lib/utils";

interface StatusOption {
  id: number;
  name: string;
}

interface KanbanColumnSettingsProps {
  statuses: StatusOption[];
  prefs: KanbanColumnPrefs;
  onChange: (next: KanbanColumnPrefs) => void;
}

/**
 * Поповер настройки колонок канбана (issue: статусов много, доской тяжело
 * управлять) - показать/скрыть колонку и порядок стрелками. Драг не берём:
 * стрелки надёжнее и на доске уже есть свой DndContext для карточек.
 */
export function KanbanColumnSettings({
  statuses,
  prefs,
  onChange,
}: KanbanColumnSettingsProps) {
  const rows = sortStatusesByOrder(statuses, prefs.order);
  const rowIds = rows.map((s) => s.id);
  const hiddenCount = prefs.hidden.filter((id) =>
    statuses.some((s) => s.id === id),
  ).length;
  const customized = hiddenCount > 0 || prefs.order.length > 0;

  const move = (index: number, dir: -1 | 1) =>
    onChange({ ...prefs, order: moveInArray(rowIds, index, dir) });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Columns3 className="size-3.5" />
          Колонки
          {hiddenCount > 0 && (
            <span className="text-xs text-muted-foreground">
              ({rows.length - hiddenCount}/{rows.length})
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <div className="flex items-center justify-between px-1 pb-1.5">
          <span className="text-sm font-medium">Колонки доски</span>
          {customized && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-1.5 py-0.5 text-xs text-muted-foreground"
              onClick={() => onChange({ ...EMPTY_KANBAN_PREFS })}
            >
              Сбросить
            </Button>
          )}
        </div>
        <ul className="flex flex-col">
          {rows.map((status, i) => {
            const hidden = prefs.hidden.includes(status.id);
            return (
              <li
                key={status.id}
                className="flex items-center gap-1 rounded-md px-1 py-1 hover:bg-accent"
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={hidden ? "Показать колонку" : "Скрыть колонку"}
                  onClick={() =>
                    onChange({
                      ...prefs,
                      hidden: toggleHidden(prefs.hidden, status.id),
                    })
                  }
                >
                  {hidden ? (
                    <EyeOff className="size-3.5 text-muted-foreground" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </Button>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    hidden && "text-muted-foreground line-through",
                  )}
                >
                  {status.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Выше"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Ниже"
                  disabled={i === rows.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className="size-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
