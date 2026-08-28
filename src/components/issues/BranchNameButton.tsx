import { useState } from "react";
import { Check, Copy, GitBranch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { chatCompletion } from "@/api/ai";
import { buildBranchSlugMessages } from "@/lib/branch-slug-prompt";
import { isAiConfigured, loadAiSettings } from "@/lib/ai-settings-storage";
import {
  renderBranchName,
  resolveBranchType,
  slugify,
} from "@/lib/branch-name";
import { loadBranchNameConfig } from "@/lib/branch-name-storage";

interface BranchNameButtonProps {
  issueId: number;
  subject: string;
  trackerName?: string | null;
  projectIdentifier?: string | null;
}

type State =
  | { status: "idle" }
  | { status: "working" }
  | { status: "ready"; name: string; copied: boolean; aiFailed: boolean };

/**
 * Генерация имени git-ветки по задаче (issue #27). Шаблон и карта
 * трекер->префикс - в настройках (SettingsPage), по умолчанию
 * `{type}/#{id}-{slug}`. slug - транслитерация темы; если включён AI и он
 * настроен, slug берётся англоязычным от модели с откатом на транслит при
 * любой ошибке. Результат кладётся в буфер обмена и показывается в поповере
 * (на случай, если clipboard заблокирован - можно выделить руками).
 */
export function BranchNameButton({
  issueId,
  subject,
  trackerName,
  projectIdentifier,
}: BranchNameButtonProps) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function generate() {
    setState({ status: "working" });
    const cfg = loadBranchNameConfig();
    const type = resolveBranchType(trackerName, cfg.typeMap);

    let slug = "";
    let aiFailed = false;
    const aiSettings = loadAiSettings();
    if (cfg.useAi && isAiConfigured(aiSettings)) {
      const result = await chatCompletion(
        aiSettings,
        buildBranchSlugMessages(subject),
      );
      if (result.ok) {
        slug = slugify(result.text);
      } else {
        aiFailed = true;
      }
    }
    if (!slug) slug = slugify(subject);

    const name = renderBranchName(cfg.template, {
      id: issueId,
      slug,
      type,
      tracker: trackerName ?? undefined,
      project: projectIdentifier ?? undefined,
    });

    let copied = false;
    try {
      await navigator.clipboard.writeText(name);
      copied = true;
    } catch {
      copied = false;
    }
    setState({ status: "ready", name, copied, aiFailed });
  }

  async function copyAgain() {
    if (state.status !== "ready") return;
    try {
      await navigator.clipboard.writeText(state.name);
      setState({ ...state, copied: true });
    } catch {
      /* оставляем как есть - имя видно, можно выделить руками */
    }
  }

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) {
          void generate();
        } else {
          setState({ status: "idle" });
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          {state.status === "working" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <GitBranch className="size-3.5" />
          )}
          Ветка
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        {state.status === "working" && (
          <p className="text-sm text-muted-foreground">Генерирую имя ветки...</p>
        )}
        {state.status === "ready" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 select-all break-all rounded bg-muted px-2 py-1 text-xs">
                {state.name}
              </code>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Скопировать"
                onClick={copyAgain}
              >
                {state.copied ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {state.copied ? "Скопировано в буфер обмена." : "Выделите и скопируйте вручную."}
              {state.aiFailed && " AI недоступен - slug по транслитерации."}
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
