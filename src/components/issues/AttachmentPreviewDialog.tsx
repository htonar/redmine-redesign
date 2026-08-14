import { useEffect, useState } from "react";
import { Download, FileQuestion, Loader2, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { downloadAttachment, fetchAttachmentBlob, type Attachment } from "@/api/attachments";
import { saveBlobAs } from "@/lib/save-file";
import { getPreviewKind, isPreviewableTextSize } from "@/components/issues/attachment-preview";
import { formatFileSize } from "@/lib/utils";
import type { RedmineClient } from "@/api/client";

export interface AttachmentPreviewDialogProps {
  attachment: Attachment | null;
  client: RedmineClient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Модалка предпросмотра вложения (issue #16): картинки/видео - через blob
 * object URL (content_url не несет авторизацию, см. fetchAttachmentBlob),
 * текст - как обычный текст. Прочие типы - без предпросмотра, только
 * "Скачать" (в дефолтную папку загрузок) и "Сохранить как" (выбор места,
 * см. saveBlobAs). Текстовые файлы свыше лимита размера не тянутся вообще
 * (isPreviewableTextSize) - чтобы не грузить мегабайтный blob только ради
 * превью, когда пользователю нужнее сразу скачать файл.
 */
export function AttachmentPreviewDialog({
  attachment,
  client,
  open,
  onOpenChange,
}: AttachmentPreviewDialogProps) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const kind = attachment ? getPreviewKind(attachment.content_type) : "unsupported";
  const textTooLarge =
    attachment !== null && kind === "text" && !isPreviewableTextSize(attachment.filesize);
  const shouldFetchPreview =
    attachment !== null && (kind === "image" || kind === "video" || (kind === "text" && !textTooLarge));

  useEffect(() => {
    setBlob(null);
    setTextContent(null);
    setLoadError(null);
    setObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    if (!open || !attachment || !client || !shouldFetchPreview) return;

    let cancelled = false;
    setIsLoading(true);

    fetchAttachmentBlob(client, attachment)
      .then(async (fetched) => {
        if (cancelled) return;
        setBlob(fetched);
        if (getPreviewKind(attachment.content_type) === "text") {
          setTextContent(await fetched.text());
        } else {
          setObjectUrl(URL.createObjectURL(fetched));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Не удалось загрузить предпросмотр.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attachment, client]);

  async function handleSaveAs() {
    if (!attachment || !client) return;
    setIsSaving(true);
    try {
      const bytes = blob ?? (await fetchAttachmentBlob(client, attachment));
      await saveBlobAs(bytes, attachment.filename);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">{attachment?.filename}</DialogTitle>
          {attachment && <DialogDescription>{formatFileSize(attachment.filesize)}</DialogDescription>}
        </DialogHeader>

        <div className="flex min-h-40 items-center justify-center overflow-auto rounded-md border border-border bg-muted/30">
          {isLoading && <Loader2 className="size-6 animate-spin text-muted-foreground" />}

          {!isLoading && loadError && (
            <Alert variant="destructive" className="m-3">
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          {!isLoading && !loadError && kind === "image" && objectUrl && (
            <img
              src={objectUrl}
              alt={attachment?.filename}
              className="max-h-[60vh] max-w-full object-contain"
            />
          )}

          {!isLoading && !loadError && kind === "video" && objectUrl && (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- у вложения нет субтитров/дорожек
            <video src={objectUrl} controls className="max-h-[60vh] max-w-full" />
          )}

          {!isLoading && !loadError && kind === "text" && textContent !== null && (
            <pre className="max-h-[60vh] w-full overflow-auto whitespace-pre-wrap break-words p-3 text-left text-xs">
              {textContent}
            </pre>
          )}

          {!isLoading && !loadError && textTooLarge && (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <FileQuestion className="size-8" />
              Файл слишком большой для предпросмотра.
            </div>
          )}

          {!isLoading && !loadError && kind === "unsupported" && (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <FileQuestion className="size-8" />
              Предпросмотр недоступен для этого типа файла.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={handleSaveAs}
            disabled={isSaving || !attachment || !client}
          >
            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Сохранить как…
          </Button>
          <Button
            className="gap-1.5"
            onClick={() => attachment && client && downloadAttachment(client, attachment)}
            disabled={!attachment || !client}
          >
            <Download className="size-3.5" />
            Скачать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
