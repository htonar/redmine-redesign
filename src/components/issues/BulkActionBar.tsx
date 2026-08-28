import { useState } from "react";
import { Eye, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Named {
  id: number;
  name: string;
}

export interface BulkActionBarProps {
  count: number;
  busy: boolean;
  /** Прогресс пакетной операции - {done,total} пока идёт, иначе null. */
  progress: { done: number; total: number } | null;
  statuses: Named[];
  members: Named[];
  versions: Named[];
  /** Показывать контролы, осмысленные только в рамках одного проекта. */
  projectScoped: boolean;
  canDelete: boolean;
  onSetStatus: (statusId: number) => void;
  onSetAssignee: (userId: number | null) => void;
  onSetVersion: (versionId: number | null) => void;
  onWatchMe: () => void;
  onDelete: () => void;
  onClear: () => void;
}

const UNASSIGNED = "__unassigned__";
const NO_VERSION = "__noversion__";

/**
 * Панель групповых действий над выбранными задачами (issue #37). Redmine REST
 * не имеет bulk-эндпоинта - каждое действие раскрывается в N параллельных
 * PUT/POST/DELETE (см. runBulk в вызывающем коде), здесь только выбор
 * действия и значения.
 */
export function BulkActionBar({
  count,
  busy,
  progress,
  statuses,
  members,
  versions,
  projectScoped,
  canDelete,
  onSetStatus,
  onSetAssignee,
  onSetVersion,
  onWatchMe,
  onDelete,
  onClear,
}: BulkActionBarProps) {
  // Селекты работают как "выбор действия" - сбрасываем отображаемое значение
  // после каждого выбора, перемонтируя по nonce (Radix Select не принимает
  // value="").
  const [nonce, setNonce] = useState(0);
  const reset = () => setNonce((n) => n + 1);

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
      <span className="text-sm font-medium">Выбрано: {count}</span>

      {busy ? (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {progress ? `${progress.done}/${progress.total}` : "Применяю..."}
        </span>
      ) : (
        <>
          <Select
            key={`status-${nonce}`}
            onValueChange={(v) => {
              onSetStatus(Number(v));
              reset();
            }}
            disabled={statuses.length === 0}
          >
            <SelectTrigger size="sm" className="w-36">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {projectScoped && (
            <Select
              key={`assignee-${nonce}`}
              onValueChange={(v) => {
                onSetAssignee(v === UNASSIGNED ? null : Number(v));
                reset();
              }}
            >
              <SelectTrigger size="sm" className="w-40">
                <SelectValue placeholder="Исполнитель" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Не назначено</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {projectScoped && versions.length > 0 && (
            <Select
              key={`version-${nonce}`}
              onValueChange={(v) => {
                onSetVersion(v === NO_VERSION ? null : Number(v));
                reset();
              }}
            >
              <SelectTrigger size="sm" className="w-40">
                <SelectValue placeholder="Версия" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_VERSION}>Без версии</SelectItem>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onWatchMe}
          >
            <Eye className="size-3.5" />
            Наблюдать
          </Button>

          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="size-3.5" />
              Удалить
            </Button>
          )}
        </>
      )}

      <Button
        variant="ghost"
        size="icon-sm"
        className="ml-auto"
        aria-label="Снять выделение"
        onClick={onClear}
        disabled={busy}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
