import { ArrowDown, ArrowUp, Columns3, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  EMPTY_LIST_COLUMN_PREFS,
  isColumnVisible,
  moveColumn,
  orderedColumns,
  toggleColumn,
  visibleOrderedColumns,
  LIST_COLUMNS,
  type ListColumnPrefs,
} from "@/lib/list-columns";
import { cn } from "@/lib/utils";

interface ListColumnSettingsProps {
  prefs: ListColumnPrefs;
  onChange: (next: ListColumnPrefs) => void;
}

/**
 * Поповер настройки колонок списка задач (issue #56) - показать/скрыть и
 * порядок стрелками, по образцу KanbanColumnSettings. «Тема» locked.
 */
export function ListColumnSettings({ prefs, onChange }: ListColumnSettingsProps) {
  const rows = orderedColumns(prefs);
  const visibleCount = visibleOrderedColumns(prefs).length;
  const customized = prefs.hidden.length > 0 || prefs.order.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Columns3 className="size-3.5" />
          Колонки
          <span className="text-xs text-muted-foreground">
            ({visibleCount}/{LIST_COLUMNS.length})
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <div className="flex items-center justify-between px-1 pb-1.5">
          <span className="text-sm font-medium">Колонки списка</span>
          {customized && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-1.5 py-0.5 text-xs text-muted-foreground"
              onClick={() => onChange({ ...EMPTY_LIST_COLUMN_PREFS })}
            >
              Сбросить
            </Button>
          )}
        </div>
        <ul className="flex max-h-80 flex-col overflow-y-auto">
          {rows.map((col, i) => {
            const visible = isColumnVisible(prefs, col);
            return (
              <li
                key={col.id}
                className="flex items-center gap-1 rounded-md px-1 py-1 hover:bg-accent"
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={col.locked}
                  aria-label={visible ? "Скрыть колонку" : "Показать колонку"}
                  onClick={() => onChange(toggleColumn(prefs, col.id))}
                >
                  {visible ? (
                    <Eye className="size-3.5" />
                  ) : (
                    <EyeOff className="size-3.5 text-muted-foreground" />
                  )}
                </Button>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    !visible && "text-muted-foreground line-through",
                    col.locked && "text-muted-foreground",
                  )}
                >
                  {col.label}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Выше"
                  disabled={i === 0}
                  onClick={() => onChange(moveColumn(prefs, col.id, -1))}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Ниже"
                  disabled={i === rows.length - 1}
                  onClick={() => onChange(moveColumn(prefs, col.id, 1))}
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
