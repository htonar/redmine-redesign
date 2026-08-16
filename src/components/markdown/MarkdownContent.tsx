import { GitPullRequest } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { RedmineClient } from "@/api/client";
import type { Attachment } from "@/api/attachments";
import { Badge } from "@/components/ui/badge";
import { useAttachmentImageUrls } from "@/components/markdown/useAttachmentImageUrls";
import { extractPrMrLinks } from "@/lib/pr-mr-links";
import { cn } from "@/lib/utils";

const PR_MR_PLATFORM_LABEL = {
  github: "GitHub PR",
  gitlab: "GitLab MR",
} as const;

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

  const prMrLinks = extractPrMrLinks(text);

  return (
    <>
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
      {prMrLinks.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <span>Связанные:</span>
          {prMrLinks.map((link) => (
            <Badge key={link.url} variant="outline" asChild>
              <a href={link.url} target="_blank" rel="noreferrer">
                <GitPullRequest />
                {PR_MR_PLATFORM_LABEL[link.platform]} #{link.number}
              </a>
            </Badge>
          ))}
        </div>
      )}
    </>
  );
}
