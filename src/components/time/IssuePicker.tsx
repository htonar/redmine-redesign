import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useIssueSearch } from "@/hooks/useIssueSearch";
import { getIssueSummary } from "@/api/issues";
import type { RedmineClient } from "@/api/client";

export interface IssuePickerProps {
  id?: string;
  client: RedmineClient | null;
  value: number | null;
  onChange: (id: number | null) => void;
  /** Сузить поиск до одного проекта - например, уже выбранного в форме. */
  projectId?: number | null;
}

/**
 * Поле "№ задачи" с подсказками вместо голого числового инпута - искать
 * задачу по номеру (с подтверждением темы) или по тексту темы, см.
 * useIssueSearch. Выбранная задача показывается чипом "#id Тема" с крестиком
 * для сброса, а не остается текстовым полем с номером - номер сам по себе
 * ничего не говорит о том, та ли это задача.
 */
export function IssuePicker({ id, client, value, onChange, projectId }: IssuePickerProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [isResolvingSelected, setIsResolvingSelected] = useState(false);
  const { results, isLoading } = useIssueSearch(client, query, projectId);

  // Если value задан снаружи (правка существующей записи) - подтягиваем
  // тему, чтобы не показывать голый номер и там тоже.
  useEffect(() => {
    if (value === null) {
      setSelectedSubject(null);
      return;
    }
    if (!client) return;
    let cancelled = false;
    setIsResolvingSelected(true);
    getIssueSummary(client, value)
      .then((issue) => {
        if (!cancelled) setSelectedSubject(issue.subject);
      })
      .catch(() => {
        if (!cancelled) setSelectedSubject(null);
      })
      .finally(() => {
        if (!cancelled) setIsResolvingSelected(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, value]);

  function handleSelect(id: number, subject: string) {
    onChange(id);
    setSelectedSubject(subject);
    setQuery("");
    setIsOpen(false);
  }

  function handleClear() {
    onChange(null);
    setSelectedSubject(null);
    setQuery("");
  }

  if (value !== null) {
    return (
      <div className="flex h-8 items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm">
        <span className="text-muted-foreground">#{value}</span>
        <span className="truncate">
          {isResolvingSelected ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          ) : (
            (selectedSubject ?? "…")
          )}
        </span>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="ml-auto size-5 shrink-0"
          aria-label="Убрать задачу"
          onClick={handleClear}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    );
  }

  const showList = isOpen && query.trim().length > 0;

  return (
    <Command shouldFilter={false} className="relative h-auto overflow-visible bg-transparent p-0">
      <CommandInput
        id={id}
        placeholder="Номер или тема задачи"
        value={query}
        onValueChange={setQuery}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
      />
      {showList && (
        <CommandList
          onMouseDown={(e) => e.preventDefault()}
          className="absolute top-full z-50 mt-1 w-full min-w-56 rounded-xl border border-border bg-popover shadow-md"
        >
          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Ищем...
            </div>
          )}
          {!isLoading && <CommandEmpty>Ничего не найдено</CommandEmpty>}
          {!isLoading && results.length > 0 && (
            <CommandGroup>
              {results.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`${r.id}-${r.subject}`}
                  onSelect={() => handleSelect(r.id, r.subject)}
                  className="flex items-center gap-1.5"
                >
                  <span className="shrink-0 text-muted-foreground">#{r.id}</span>
                  <span className="truncate">{r.subject}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      )}
    </Command>
  );
}
