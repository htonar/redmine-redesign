import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface HotkeyRow {
  keys: string[];
  description: string;
  /** true - клавиши нажимаются одновременно (Ctrl+Enter), false - последовательно (g, затем i). */
  chord?: boolean;
}

const GLOBAL_HOTKEYS: HotkeyRow[] = [
  { keys: ["c"], description: "Создать задачу" },
  { keys: ["/"], description: "Фокус в поиск" },
  { keys: ["g", "i"], description: "Перейти к задачам" },
  { keys: ["g", "d"], description: "Перейти на дашборд" },
  { keys: ["g", "t"], description: "Перейти к учету времени" },
  { keys: ["?"], description: "Показать эту подсказку" },
];

const ISSUE_PAGE_HOTKEYS: HotkeyRow[] = [
  { keys: ["e"], description: "Редактировать открытую задачу" },
  {
    keys: ["Ctrl", "Enter"],
    description: "Отправить комментарий",
    chord: true,
  },
  {
    keys: ["Ctrl", "S"],
    description: "Сохранить форму правки задачи",
    chord: true,
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
      {children}
    </kbd>
  );
}

function HotkeyList({ rows }: { rows: HotkeyRow[] }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div
          key={row.description}
          className="flex items-center justify-between gap-4 text-sm"
        >
          <span className="text-muted-foreground">{row.description}</span>
          <span className="flex items-center gap-1">
            {row.keys.map((key, i) => (
              <span key={key} className="flex items-center gap-1">
                <Kbd>{key}</Kbd>
                {i < row.keys.length - 1 && (
                  <span className="text-xs text-muted-foreground">
                    {row.chord ? "+" : "затем"}
                  </span>
                )}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

export interface HotkeysHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Справка по горячим клавишам - открывается по "?" (см. useGlobalHotkeys) и
 * по кнопке в Topbar. Не перечисляет хоткеи, встроенные в Radix
 * (Esc/стрелки в диалогах и селектах) - только наши собственные.
 */
export function HotkeysHelpDialog({
  open,
  onOpenChange,
}: HotkeysHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Горячие клавиши</DialogTitle>
          <DialogDescription>
            Не работают, пока фокус в поле ввода или открыт диалог.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <HotkeyList rows={GLOBAL_HOTKEYS} />
          <div className="border-t border-border pt-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              На карточке задачи
            </div>
            <HotkeyList rows={ISSUE_PAGE_HOTKEYS} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
