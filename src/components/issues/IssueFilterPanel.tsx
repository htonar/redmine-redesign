import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/UserAvatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Значения расширенных фильтров списка задач (issue #29). */
export interface AdvancedIssueFilters {
  trackerId: number | null;
  priorityId: number | null;
  versionId: number | null;
  authorId: number | null;
  subject: string;
}

export const EMPTY_ADVANCED_FILTERS: AdvancedIssueFilters = {
  trackerId: null,
  priorityId: null,
  versionId: null,
  authorId: null,
  subject: "",
};

interface Option {
  id: number;
  name: string;
  /** Только для авторов - email для Gravatar-аватарки (issue #44). */
  mail?: string;
}

interface IssueFilterPanelProps {
  value: AdvancedIssueFilters;
  onChange: (next: AdvancedIssueFilters) => void;
  trackers: Option[];
  priorities: Option[];
  versions: Option[];
  members: Option[];
  /** Версия/автор осмысленны только при выбранном проекте. */
  projectSelected: boolean;
  /** В режиме нативного Query Redmine игнорирует свои фильтры - панель выключена. */
  disabled?: boolean;
}

/** Сентинел "любой" - Radix Select не допускает value="". */
const ANY = "__any__";

export function activeFilterCount(f: AdvancedIssueFilters): number {
  let n = 0;
  if (f.trackerId !== null) n++;
  if (f.priorityId !== null) n++;
  if (f.versionId !== null) n++;
  if (f.authorId !== null) n++;
  if (f.subject.trim()) n++;
  return n;
}

export function IssueFilterPanel({
  value,
  onChange,
  trackers,
  priorities,
  versions,
  members,
  projectSelected,
  disabled,
}: IssueFilterPanelProps) {
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(value);

  const set = (patch: Partial<AdvancedIssueFilters>) =>
    onChange({ ...value, ...patch });

  const idSelect = (
    label: string,
    field: "trackerId" | "priorityId" | "versionId" | "authorId",
    options: Option[],
    hint?: string,
    withAvatar = false,
  ) => (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Select
        value={value[field] === null ? ANY : String(value[field])}
        onValueChange={(v) =>
          set({ [field]: v === ANY ? null : Number(v) } as Partial<AdvancedIssueFilters>)
        }
        disabled={hint != null}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Любой</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={String(o.id)}>
              {withAvatar ? (
                <span className="flex items-center gap-2">
                  <UserAvatar
                    name={o.name}
                    email={o.mail}
                    className="size-5"
                  />
                  {o.name}
                </span>
              ) : (
                o.name
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  const projectHint = projectSelected
    ? undefined
    : "Выберите проект в шапке";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={disabled}>
          <SlidersHorizontal className="size-3.5" />
          Фильтры
          {count > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Расширенные фильтры</span>
            {count > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto gap-1 px-1.5 py-0.5 text-xs text-muted-foreground"
                onClick={() => onChange({ ...EMPTY_ADVANCED_FILTERS })}
              >
                <X className="size-3" />
                Сбросить
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="issue-filter-subject">Тема содержит</Label>
            <Input
              id="issue-filter-subject"
              value={value.subject}
              placeholder="подстрока в теме"
              onChange={(e) => set({ subject: e.target.value })}
            />
          </div>

          {idSelect("Трекер", "trackerId", trackers)}
          {idSelect("Приоритет", "priorityId", priorities)}
          {idSelect("Версия", "versionId", versions, projectHint)}
          {idSelect("Автор", "authorId", members, projectHint, true)}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ChipsProps {
  value: AdvancedIssueFilters;
  onChange: (next: AdvancedIssueFilters) => void;
  trackers: Option[];
  priorities: Option[];
  versions: Option[];
  members: Option[];
}

/** Активные расширенные фильтры чипами с крестиком - под панелью фильтров. */
export function ActiveFilterChips({
  value,
  onChange,
  trackers,
  priorities,
  versions,
  members,
}: ChipsProps) {
  const set = (patch: Partial<AdvancedIssueFilters>) =>
    onChange({ ...value, ...patch });

  const name = (options: Option[], id: number | null) =>
    options.find((o) => o.id === id)?.name ?? `#${id}`;

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (value.subject.trim())
    chips.push({
      key: "subject",
      label: `Тема: «${value.subject.trim()}»`,
      clear: () => set({ subject: "" }),
    });
  if (value.trackerId !== null)
    chips.push({
      key: "tracker",
      label: `Трекер: ${name(trackers, value.trackerId)}`,
      clear: () => set({ trackerId: null }),
    });
  if (value.priorityId !== null)
    chips.push({
      key: "priority",
      label: `Приоритет: ${name(priorities, value.priorityId)}`,
      clear: () => set({ priorityId: null }),
    });
  if (value.versionId !== null)
    chips.push({
      key: "version",
      label: `Версия: ${name(versions, value.versionId)}`,
      clear: () => set({ versionId: null }),
    });
  if (value.authorId !== null)
    chips.push({
      key: "author",
      label: `Автор: ${name(members, value.authorId)}`,
      clear: () => set({ authorId: null }),
    });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <Badge key={c.key} variant="secondary" className="gap-1 pr-1">
          {c.label}
          <button
            type="button"
            aria-label={`Убрать фильтр: ${c.label}`}
            onClick={c.clear}
            className="rounded p-0.5 hover:bg-foreground/10"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}
