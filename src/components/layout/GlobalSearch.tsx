import { useState } from "react";
import { useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import type { RedmineClient } from "@/api/client";
import type { SearchResult } from "@/api/search";

/**
 * Машинные значения `type` в ответе /search.json не задокументированы явно в
 * REST-вики - взяты из практики самого Redmine (app/models/*, где строится
 * поиск). Если встретится незнакомый тип - не гадаем, просто показываем сырое
 * значение (см. typeLabel ниже), не выдумываем неверный перевод.
 */
const TYPE_LABELS: Record<string, string> = {
  issue: "Задача",
  project: "Проект",
  news: "Новость",
  document: "Документ",
  changeset: "Коммит",
  "wiki-page": "Wiki",
  message: "Форум",
};

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

/** id задачи из url результата поиска ("/issues/123") - для перехода на нашу карточку вместо чужой вкладки. */
function issueIdFromUrl(url: string): number | null {
  const match = url.match(/\/issues\/(\d+)(?:\.|$)/);
  return match ? Number(match[1]) : null;
}

export interface GlobalSearchProps {
  client: RedmineClient | null;
}

/**
 * Поиск в Topbar - GET /search.json по мере ввода (debounce в useGlobalSearch).
 * Результаты-задачи ведут на нашу карточку (/issues/:id), остальные типы
 * (проекты, wiki, документы...) - у нас для них нет экранов, открываем
 * страницу в самом Redmine в новой вкладке.
 */
export function GlobalSearch({ client }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { results, isLoading } = useGlobalSearch(client, query);
  const navigate = useNavigate();

  const showList = isOpen && query.trim().length > 0;

  function handleSelect(result: SearchResult) {
    const issueId = result.type === "issue" ? issueIdFromUrl(result.url) : null;
    if (issueId) {
      navigate(`/issues/${issueId}`);
    } else {
      // result.url приходит от Redmine уже абсолютным (полный http(s)://host/...,
      // не путь - несмотря на то что можно было ожидать относительный путь) -
      // открываем как есть, без baseUrl спереди.
      window.open(result.url, "_blank", "noreferrer");
    }
    setQuery("");
    setIsOpen(false);
  }

  return (
    <Command
      shouldFilter={false}
      className="relative h-auto overflow-visible bg-transparent p-0"
    >
      <CommandInput
        placeholder="Поиск..."
        value={query}
        onValueChange={setQuery}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
      />
      {showList && (
        <CommandList
          // Не даем инпуту потерять фокус до onClick по пункту - иначе
          // onBlur выше закроет список раньше, чем сработает выбор.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute top-full z-50 mt-1 w-full min-w-64 rounded-xl border border-border bg-popover shadow-md"
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
              {results.map((result) => (
                <CommandItem
                  key={`${result.type}-${result.id}`}
                  value={`${result.type}-${result.id}`}
                  onSelect={() => handleSelect(result)}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      {typeLabel(result.type)}
                    </span>
                    <span className="truncate">{result.title}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      )}
    </Command>
  );
}
