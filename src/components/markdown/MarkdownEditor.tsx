import { useRef, useState } from "react";
import {
  Bold,
  Code,
  Eye,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { uploadAttachment, type UploadedFile } from "@/api/attachments";
import type { RedmineClient } from "@/api/client";
import { cn } from "@/lib/utils";

interface ToolbarAction {
  icon: typeof Bold;
  label: string;
  /** Оборачивает выделенный текст (или вставляет плейсхолдер, если ничего не выделено). */
  wrap: { prefix: string; suffix: string; placeholder: string };
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  {
    icon: Bold,
    label: "Жирный",
    wrap: { prefix: "**", suffix: "**", placeholder: "текст" },
  },
  {
    icon: Italic,
    label: "Курсив",
    wrap: { prefix: "_", suffix: "_", placeholder: "текст" },
  },
  {
    icon: Code,
    label: "Код",
    wrap: { prefix: "`", suffix: "`", placeholder: "код" },
  },
  {
    icon: LinkIcon,
    label: "Ссылка",
    wrap: { prefix: "[", suffix: "](url)", placeholder: "текст" },
  },
  {
    icon: Heading2,
    label: "Заголовок",
    wrap: { prefix: "## ", suffix: "", placeholder: "Заголовок" },
  },
  {
    icon: List,
    label: "Список",
    wrap: { prefix: "- ", suffix: "", placeholder: "пункт" },
  },
  {
    icon: ListOrdered,
    label: "Нумерованный список",
    wrap: { prefix: "1. ", suffix: "", placeholder: "пункт" },
  },
];

export interface MarkdownEditorProps {
  id?: string;
  client: RedmineClient | null;
  value: string;
  onChange: (value: string) => void;
  /** Вызывается после успешной загрузки вставленного по Ctrl+V файла - вызывающий сам решает, приложить ли его к задаче сразу или отложить до сохранения формы. См. CLAUDE.md, "Markdown-редактор". */
  onUpload?: (file: UploadedFile) => void;
  /** Ctrl/Cmd+Enter - для комментария (отправить), не обязателен. */
  onSubmitShortcut?: () => void;
  rows?: number;
  placeholder?: string;
}

/**
 * Textarea с Markdown-панелью инструментов, переключением в предпросмотр
 * (`MarkdownContent`) и вставкой файлов по Ctrl+V. Вставленный файл сначала
 * грузится как байты (`POST /uploads`, см. uploadAttachment) - сам по себе
 * это не прикрепляет его к задаче, только даёт token; вызывающий отвечает за
 * то, чтобы этот token попал в `uploads` при следующем create/update задачи
 * (см. IssueFieldsInput.uploads), иначе загрузка "потеряется". В текст сразу
 * вставляется markdown-ссылка по ИМЕНИ файла - `![](filename)` для картинок,
 * `[filename](filename)` для остального - Redmine резолвит такую ссылку в
 * прикреплённый файл с совпадающим именем сам на своей стороне при рендере,
 * тот же принцип мы повторяем на клиенте в MarkdownContent.
 */
export function MarkdownEditor({
  id,
  client,
  value,
  onChange,
  onUpload,
  onSubmitShortcut,
  rows = 5,
  placeholder,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function applyWrap(action: ToolbarAction) {
    const el = textareaRef.current;
    if (!el) return;
    const { prefix, suffix, placeholder: ph } = action.wrap;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || ph;
    const next =
      value.slice(0, start) + prefix + selected + suffix + value.slice(end);
    onChange(next);
    // Курсор - сразу после вставленного фрагмента, а не в начало поля -
    // иначе продолжать печатать после форматирования неудобно.
    const cursor = start + prefix.length + selected.length + suffix.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  async function handleFiles(files: File[]) {
    if (!client || files.length === 0) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      for (const file of files) {
        const uploaded = await uploadAttachment(client, file);
        onUpload?.(uploaded);
        const isImage = file.type.startsWith("image/");
        const markdown = isImage
          ? `![${file.name}](${file.name})`
          : `[${file.name}](${file.name})`;
        const el = textareaRef.current;
        const pos = el ? el.selectionStart : value.length;
        onChange(value.slice(0, pos) + markdown + value.slice(pos));
      }
    } catch (e) {
      setUploadError(
        e instanceof Error ? e.message : "Не удалось загрузить файл.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.files);
    if (files.length === 0) return;
    e.preventDefault();
    void handleFiles(files);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Форматирование"
          className="flex items-center gap-0.5"
        >
          {TOOLBAR_ACTIONS.map((action) => (
            <Button
              key={action.label}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={action.label}
              disabled={mode === "preview"}
              onClick={() => applyWrap(action)}
            >
              <action.icon className="size-3.5" />
            </Button>
          ))}
          {isUploading && (
            <Loader2 className="ml-1 size-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-muted-foreground"
          aria-pressed={mode === "preview"}
          onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
        >
          {mode === "edit" ? (
            <>
              <Eye className="size-3.5" />
              Предпросмотр
            </>
          ) : (
            <>
              <Pencil className="size-3.5" />
              Править
            </>
          )}
        </Button>
      </div>

      {mode === "edit" ? (
        <Textarea
          id={id}
          ref={textareaRef}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            // e.code (физическая клавиша, не зависит от раскладки/языка
            // ввода) - в дополнение к e.key, на случай если на какой-то
            // раскладке/браузере e.key для Enter отдаёт что-то нестандартное
            // (репорт пользователя - Ctrl+Enter не срабатывал, не
            // воспроизвелось в тестовом окружении, но e.code надёжнее e.key
            // в принципе, не помешает).
            const isEnter =
              e.key === "Enter" ||
              e.code === "Enter" ||
              e.code === "NumpadEnter";
            if (onSubmitShortcut && (e.ctrlKey || e.metaKey) && isEnter) {
              e.preventDefault();
              onSubmitShortcut();
            }
          }}
        />
      ) : (
        <div
          className={cn(
            "min-h-16 rounded-lg border border-input px-2.5 py-1.5",
            !value.trim() && "text-sm text-muted-foreground",
          )}
          style={{ minHeight: `${rows * 1.5}rem` }}
        >
          {value.trim() ? (
            <MarkdownContent text={value} client={client} />
          ) : (
            "Нечего показать"
          )}
        </div>
      )}

      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
      {mode === "edit" && (
        <p className="text-[11px] text-muted-foreground">
          Markdown - **жирный**, _курсив_, ` код `. Ctrl+V вставит скопированный
          файл/картинку и прикрепит к задаче.
        </p>
      )}
    </div>
  );
}
