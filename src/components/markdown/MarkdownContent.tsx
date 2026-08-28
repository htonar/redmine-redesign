import { GitMerge, GitPullRequest, GitPullRequestClosed, GitPullRequestDraft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { RedmineClient } from "@/api/client";
import type { Attachment } from "@/api/attachments";
import { Badge } from "@/components/ui/badge";
import {
  useAttachmentMediaUrls,
  type ResolvedMedia,
} from "@/components/markdown/useAttachmentMediaUrls";
import { usePrMrStatuses } from "@/hooks/usePrMrStatuses";
import { extractPrMrLinks } from "@/lib/pr-mr-links";
import { parseImageTitle, textileImagesToMarkdown } from "@/lib/textile-images";
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
  /** Для резолва `![](filename)`, ссылающихся на прикреплённые к задаче медиа - см. useAttachmentMediaUrls. */
  attachments?: Attachment[];
  client?: RedmineClient | null;
  /**
   * Дополнительные медиа по имени файла - для предпросмотра в редакторе, где
   * файл ещё не прикреплён к задаче (только что вставлен по Ctrl+V), но blob
   * уже есть локально. Имеет приоритет над резолвом из attachments.
   */
  extraMedia?: Record<string, ResolvedMedia>;
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
 *
 * Исключение - Textile-разметка картинок (`!name!`, `!{width: 680px}.name!`):
 * такие вставки частые (вставка из буфера на Textile-инстансе), поэтому их
 * переписываем в markdown перед рендером (см. textileImagesToMarkdown).
 */
export function MarkdownContent({
  text,
  attachments,
  client,
  extraMedia,
  className,
}: MarkdownContentProps) {
  const attachmentMedia = useAttachmentMediaUrls(client ?? null, attachments);
  const media = { ...attachmentMedia, ...extraMedia };
  const prMrLinks = extractPrMrLinks(text);
  const prMrStatuses = usePrMrStatuses(prMrLinks);

  if (!text.trim()) return null;

  // Textile-картинки (`!name!`, `!{width: 680px}.name!`, ...) в тексте с
  // инстансов на Textile-формате - переписываем в markdown, размер уезжает
  // в title и разбирается в рендерере img/video ниже.
  const rendered = textileImagesToMarkdown(text);

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
            img: ({ src, alt, title }) => {
              const hit = typeof src === "string" ? media[src] : undefined;
              const { width, height, title: realTitle } = parseImageTitle(title);
              const dimStyle =
                width || height ? { maxWidth: "100%", width, height } : undefined;
              if (hit?.kind === "video") {
                return (
                  <video
                    src={hit.url}
                    controls
                    style={dimStyle}
                    className="max-w-full rounded-lg border border-border"
                  />
                );
              }
              if (hit?.kind === "audio") {
                return <audio src={hit.url} controls className="w-full" />;
              }
              return (
                <img
                  src={hit?.url ?? src}
                  alt={alt ?? ""}
                  title={realTitle}
                  style={dimStyle}
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
          {rendered}
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
