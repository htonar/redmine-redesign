import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { celebrate } from "@/lib/celebrate";
import { useIssueStatuses } from "@/hooks/useIssueStatuses";
import { useKanbanIssues } from "@/hooks/useKanbanIssues";
import { updateIssue, type IssueSummary } from "@/api/issues";
import type { RedmineClient } from "@/api/client";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

interface KanbanCardProps {
  issue: IssueSummary;
  draggable: boolean;
  onOpen: () => void;
}

/**
 * Карточка задачи. Драг захватывается только за ручку (GripVertical) - не
 * всей карточкой, иначе клик "открыть задачу" и начало перетаскивания
 * конфликтуют (dnd-kit не может надежно отличить "чуть дрогнула рука при
 * клике" от намеренного драга без ручки, особенно на тачпаде).
 */
function KanbanCard({ issue, draggable, onOpen }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: issue.id,
      disabled: !draggable,
    });

  return (
    <div
      ref={setNodeRef}
      style={
        transform ? { transform: CSS.Translate.toString(transform) } : undefined
      }
      className={cn(
        "flex items-start gap-1.5 rounded-lg border border-border bg-card p-2.5 text-sm shadow-xs transition-[transform,box-shadow] motion-reduce:transition-none",
        !isDragging &&
          "hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0",
        isDragging && "z-10 opacity-50",
      )}
    >
      {draggable && (
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Перетащить"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
      )}
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={onOpen}
      >
        <div className="text-xs text-muted-foreground">#{issue.id}</div>
        <div className="line-clamp-2 font-medium">{issue.subject}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {issue.priority?.name && (
            <Badge variant="outline" className="text-[11px]">
              {issue.priority.name}
            </Badge>
          )}
          {issue.assigned_to?.name && (
            <span className="truncate text-xs text-muted-foreground">
              {issue.assigned_to.name}
            </span>
          )}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          обновлено {formatDate(issue.updated_on)}
        </div>
      </button>
    </div>
  );
}

interface KanbanColumnProps {
  statusId: number;
  title: string;
  isClosed: boolean;
  issues: IssueSummary[];
  canEdit: boolean;
  onOpenIssue: (id: number) => void;
}

function KanbanColumn({
  statusId,
  title,
  isClosed,
  issues,
  canEdit,
  onOpenIssue,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: statusId });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full w-72 shrink-0 flex-col gap-2 rounded-lg border border-border bg-muted/40 p-2",
        isOver && "border-primary bg-primary/5",
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-1 pt-1">
        <div className="flex items-center gap-1.5">
          <Badge variant={isClosed ? "secondary" : "default"}>{title}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">{issues.length}</span>
      </div>
      {/* min-h-0 - иначе flex-контейнер не даст себе сжаться и overflow-y-auto
          не сработает (карточки просто раздвинут колонку по высоте, тот же
          эффект, от которого уходим - см. CLAUDE.md, "Канбан: фиксированная
          высота"). */}
      <div
        data-kanban-column-scroll
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto"
      >
        {issues.map((issue) => (
          <KanbanCard
            key={issue.id}
            issue={issue}
            draggable={canEdit}
            onOpen={() => onOpenIssue(issue.id)}
          />
        ))}
        {issues.length === 0 && (
          <div className="rounded-lg border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
            Пусто
          </div>
        )}
      </div>
    </div>
  );
}

export interface KanbanBoardProps {
  client: RedmineClient | null;
  projectId: number;
  assignee: "me" | "all";
  canEdit: boolean;
}

/**
 * Канбан-доска: колонки - статусы задачи (глобальный справочник, не per-
 * project - см. CLAUDE.md), карточки - задачи текущего проекта/фильтра.
 * Перетаскивание карточки в другую колонку = смена статуса, тот же
 * updateIssue(client, id, { statusId }), что и Select в IssueDetailPage.
 * Доступные переходы статуса заранее не проверяем (это workflow, зависящий
 * от роли/трекера/текущего статуса - см. allowed_statuses) - было бы N+1
 * запросов на каждую карточку ради подсветки; вместо этого отправляем
 * запрос как есть и откатываем карточку назад, если Redmine отказал.
 */
export function KanbanBoard({
  client,
  projectId,
  assignee,
  canEdit,
}: KanbanBoardProps) {
  const navigate = useNavigate();
  const { statuses, isLoading: statusesLoading } = useIssueStatuses(client);
  const { issues, totalCount, isLoading, error, hasMore, moveLocally } =
    useKanbanIssues(client, {
      projectId,
      assignee,
      sort: "priority:desc,updated_on:desc",
    });
  const [dragError, setDragError] = useState<string | null>(null);
  const [activeIssue, setActiveIssue] = useState<IssueSummary | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const columns = useMemo(() => {
    const byStatus = new Map<number, IssueSummary[]>();
    for (const issue of issues) {
      if (!issue.status) continue;
      const list = byStatus.get(issue.status.id) ?? [];
      list.push(issue);
      byStatus.set(issue.status.id, list);
    }
    return statuses.map((s) => ({
      status: s,
      issues: byStatus.get(s.id) ?? [],
    }));
  }, [statuses, issues]);

  function handleDragStart(event: DragStartEvent) {
    const issue = issues.find((i) => i.id === Number(event.active.id));
    setActiveIssue(issue ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveIssue(null);
    if (!client || !over) return;

    const issueId = Number(active.id);
    const targetStatusId = Number(over.id);
    const issue = issues.find((i) => i.id === issueId);
    const targetStatus = statuses.find((s) => s.id === targetStatusId);
    if (!issue || !targetStatus || issue.status?.id === targetStatus.id) return;

    const prevStatus = issue.status;
    setDragError(null);
    moveLocally(
      issueId,
      targetStatus.id,
      targetStatus.name,
      targetStatus.isClosed,
    );

    try {
      await updateIssue(client, issueId, { statusId: targetStatus.id });
      // Мягкая геймификация - confetti при перетаскивании карточки в
      // закрывающую колонку (не при каждом драге). См. lib/celebrate.ts.
      if (targetStatus.isClosed && !prevStatus?.is_closed) celebrate();
    } catch (e) {
      if (prevStatus)
        moveLocally(
          issueId,
          prevStatus.id,
          prevStatus.name,
          prevStatus.is_closed,
        );
      setDragError(
        e instanceof Error
          ? e.message
          : "Не удалось изменить статус - возможно, такой переход недоступен для этой задачи.",
      );
    }
  }

  // Горизонтальный overflow-x-auto по умолчанию не реагирует на колесо мыши
  // (только на drag за сам скроллбар) - пользователь на это пожаловался.
  // Переводим вертикальный wheel в горизонтальный скролл доски, но только
  // если курсор не над списком карточек колонки (data-kanban-column-scroll)
  // - тот скроллится вертикально сам по себе нативно, перехватывать не надо.
  function handleBoardWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (e.deltaY === 0) return;
    const columnScroll = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-kanban-column-scroll]",
    );
    // Если под курсором список карточек колонки и там реально есть что
    // скроллить вертикально - не мешаем, пусть скроллится нативно. Если
    // список короткий (скроллить нечего) или курсор вне списка (шапка
    // колонки, зазор между колонками) - переводим wheel в горизонтальный
    // скролл доски.
    if (columnScroll && columnScroll.scrollHeight > columnScroll.clientHeight) {
      return;
    }
    e.currentTarget.scrollLeft += e.deltaY;
  }

  if (statusesLoading || isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Загрузка...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {dragError && (
        <Alert variant="destructive">
          <AlertDescription>{dragError}</AlertDescription>
        </Alert>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Фиксированная высота (не max-h) - иначе высота доски "гуляет"
            вместе с числом карточек в самой заполненной колонке (была ragged
            и непредсказуемая - см. CLAUDE.md). Колонки скроллятся по
            вертикали независимо друг от друга, доска - по горизонтали. */}
        <div
          className="flex h-[70vh] gap-3 overflow-x-auto pb-2"
          onWheel={handleBoardWheel}
        >
          {columns.map(({ status, issues: columnIssues }) => (
            <KanbanColumn
              key={status.id}
              statusId={status.id}
              title={status.name}
              isClosed={status.isClosed}
              issues={columnIssues}
              canEdit={canEdit}
              onOpenIssue={(id) => navigate(`/issues/${id}`)}
            />
          ))}
        </div>
        <DragOverlay>
          {activeIssue && (
            <KanbanCard issue={activeIssue} draggable onOpen={() => {}} />
          )}
        </DragOverlay>
      </DndContext>

      {hasMore && (
        <p className="text-xs text-muted-foreground">
          Показаны первые {issues.length} из {totalCount} - сузьте фильтр
          (например, "Мои задачи"), если нужны остальные; доска не подгружает
          страницами.
        </p>
      )}
      {!hasMore && issues.length === 0 && (
        <div className="rounded-lg border border-border bg-card py-8 text-center text-muted-foreground">
          Задач по этим фильтрам не найдено
        </div>
      )}
    </div>
  );
}
