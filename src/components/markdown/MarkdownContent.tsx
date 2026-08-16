import { GitMerge, GitPullRequest, GitPullRequestClosed, GitPullRequestDraft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { RedmineClient } from "@/api/client";
import type { Attachment } from "@/api/attachments";
import { Badge } from "@/components/ui/badge";
import { useAttachmentImageUrls } from "@/components/markdown/useAttachmentImageUrls";
import { usePrMrStatuses } from "@/hooks/usePrMrStatuses";
import { extractPrMrLinks } from "@/lib/pr-mr-links";
import type { PrMrStatus } from "@/lib/pr-mr-status";
import { cn } from "@/lib/utils";

const PR_MR_PLATFORM_LABEL = {
  github: "GitHub PR",
  gitlab: "GitLab MR",
} as const;

/**
 * Живой статус (issue #22, шаг 2) меняет цвет самого чипа (решение из
 * грилинга - не платформенный брендинг, а семантика статуса). Без статуса
 * (undefined - нет токена / ошибка / еще грузится) - нейтральный `outline`,
 * как было в шаге 1.
 */
const PR_MR_STATUS_ICON: Record<PrMrStatus, typeof GitPullRequest> = {
  open: GitPullRequest,
  merged: GitMerge,
  closed: GitPullRequestClosed,
  draft: GitPullRequestDraft,
};

const PR_MR_STATUS_CLASS: Record<PrMrStatus, string> = {
  open: "border-transparent bg-emerald-600 text-white",
  merged: "border-transparent bg-violet-600 text-white",
  closed: "border-transparent bg-red-600 text-white",
  draft: "border-transparent bg-muted-foreground/70 text-white",
};

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
  const prMrLinks = extractPrMrLinks(text);
  const prMrStatuses = usePrMrStatuses(prMrLinks);

  if (!text.trim()) return null;

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
          {prMrLinks.map((link) => {
            const status = prMrStatuses[link.url];
            const Icon = status ? PR_MR_STATUS_ICON[status] : GitPullRequest;
            return (
              <Badge
                key={link.url}
                variant="outline"
                asChild
                className={status ? PR_MR_STATUS_CLASS[status] : undefined}
              >
                <a href={link.url} target="_blank" rel="noreferrer">
                  <Icon />
                  {PR_MR_PLATFORM_LABEL[link.platform]} #{link.number}
                </a>
              </Badge>
            );
          })}
        </div>
      )}
    </>
  );
}
