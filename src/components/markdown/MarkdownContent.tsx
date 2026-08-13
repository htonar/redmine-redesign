import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { RedmineClient } from "@/api/client";
import type { Attachment } from "@/api/attachments";
import { useAttachmentImageUrls } from "@/components/markdown/useAttachmentImageUrls";
import { cn } from "@/lib/utils";

export interface MarkdownContentProps {
  text: string;
  /** Для резолва `![](filename)`, ссылающихся на прикреплённые к задаче картинки - см. useAttachmentImageUrls. */
  attachments?: Attachment[];
  client?: RedmineClient | null;
  className?: string;
}

/**
 * Рендер Markdown-текста (описание задачи, комментарии) - см. CLAUDE.md,
 * "Markdown-редактор". `prose` - typography-плагин Tailwind, тема
 * (`dark:prose-invert`) следует общему переключателю `.dark` приложения.
 *
 * Предполагает, что у целевого Redmine-инстанса формат текста в настройках -
 * Markdown (Settings -> General -> Text formatting), не Textile (старый
 * дефолт Redmine) - мы рендерим сами на клиенте, не через HTML с сервера,
 * поэтому если инстанс настроен на Textile, наш рендер не будет совпадать с
 * тем, что видит пользователь на самом Redmine. Не проверяется через API -
 * такой настройки не отдаётся ни одним публичным REST-эндпоинтом.
 */
export function MarkdownContent({
  text,
  attachments,
  client,
  className,
}: MarkdownContentProps) {
  const imageUrls = useAttachmentImageUrls(client ?? null, attachments);

  if (!text.trim()) return null;

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none prose-pre:bg-muted prose-code:before:content-none prose-code:after:content-none",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ src, alt }) => {
            const resolved =
              typeof src === "string" && imageUrls[src] ? imageUrls[src] : src;
            return (
              <img
                src={resolved}
                alt={alt ?? ""}
                className="rounded-lg border border-border"
              />
            );
          },
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
