import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Loader2, Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchResults } from "@/hooks/useSearchResults";
import type { SearchResult, SearchTypeFilter } from "@/api/search";
import {
  SEARCH_TYPE_FILTERS,
  searchTypeLabel,
} from "@/lib/search-types";
import { cn } from "@/lib/utils";

function issueIdFromUrl(url: string): number | null {
  const m = url.match(/\/issues\/(\d+)(?:\.|$)/);
  return m ? Number(m[1]) : null;
}

function isTypeFilter(v: string | null): v is SearchTypeFilter {
  return SEARCH_TYPE_FILTERS.some((f) => f.key === v);
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Полноценная страница результатов поиска (issue #43) - в отличие от
 * подсказок в Topbar: пагинация, счётчик, фильтр по типу, тумблер "только
 * открытые задачи". Запрос синхронизирован с `?q=` в URL.
 */
export function SearchPage() {
  const { client } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const urlQuery = params.get("q") ?? "";
  const urlType = params.get("type");
  const type: SearchTypeFilter = isTypeFilter(urlType) ? urlType : "all";
  const openIssuesOnly = params.get("open") === "1";

  const [input, setInput] = useState(urlQuery);
  useEffect(() => setInput(urlQuery), [urlQuery]);

  const { results, totalCount, isLoading, isLoadingMore, error, hasMore, loadMore } =
    useSearchResults(client, urlQuery, type, openIssuesOnly);

  function updateParams(next: Record<string, string | null>) {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(next)) {
          if (v === null || v === "") p.delete(k);
          else p.set(k, v);
        }
        return p;
      },
      { replace: true },
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    updateParams({ q: input.trim() || null });
  }

  function openResult(r: SearchResult) {
    const issueId = r.type.startsWith("issue") ? issueIdFromUrl(r.url) : null;
    if (issueId) navigate(`/issues/${issueId}`);
    else window.open(r.url, "_blank", "noreferrer");
  }

  const showOpenToggle = type === "all" || type === "issues";

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          autoFocus
          placeholder="Поиск по задачам, проектам, wiki..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit" className="gap-1.5">
          <SearchIcon className="size-4" />
          Найти
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5">
        {SEARCH_TYPE_FILTERS.map((f) => (
          <Button
            key={f.key}
            variant={type === f.key ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            aria-pressed={type === f.key}
            onClick={() =>
              updateParams({ type: f.key === "all" ? null : f.key })
            }
          >
            {f.label}
          </Button>
        ))}
        {showOpenToggle && (
          <Label className="ml-2 flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
            <Switch
              size="sm"
              checked={openIssuesOnly}
              onCheckedChange={(v) =>
                updateParams({ open: v ? "1" : null })
              }
            />
            Только открытые задачи
          </Label>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!urlQuery.trim() && (
        <EmptyState title="Введите запрос" size="default" />
      )}

      {urlQuery.trim() && isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Ищем...
        </div>
      )}

      {urlQuery.trim() && !isLoading && !error && (
        <>
          <div className="text-sm text-muted-foreground">
            {totalCount > 0
              ? `Показано ${results.length} из ${totalCount}`
              : "Ничего не найдено"}
          </div>

          <ul className="flex flex-col gap-1">
            {results.map((r) => (
              <li key={`${r.type}-${r.id}`}>
                <button
                  type="button"
                  onClick={() => openResult(r)}
                  className={cn(
                    "flex w-full flex-col items-start gap-1 rounded-lg border border-border bg-card p-3 text-left text-sm shadow-xs transition-colors hover:border-primary/50",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[11px]">
                      {searchTypeLabel(r.type)}
                    </Badge>
                    <span className="font-medium">{r.title}</span>
                  </span>
                  {r.description && (
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {r.description}
                    </span>
                  )}
                  {r.datetime && (
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(r.datetime)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          {hasMore && (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={loadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore && <Loader2 className="size-3.5 animate-spin" />}
              Показать ещё
            </Button>
          )}
        </>
      )}
    </div>
  );
}
