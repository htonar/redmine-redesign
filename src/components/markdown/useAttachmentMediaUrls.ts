import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";
import type { Attachment } from "@/api/attachments";

export type MediaKind = "image" | "video" | "audio";

export interface ResolvedMedia {
  url: string;
  kind: MediaKind;
}

/** Тип медиа по content_type вложения, либо null для не-медиа. */
export function mediaKind(contentType: string | undefined | null): MediaKind | null {
  if (!contentType) return null;
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  return null;
}

/**
 * Redmine резолвит `![](filename)` в тексте задачи/комментария в прикреплённый
 * файл с таким именем сам, при рендере собственного HTML - но мы рендерим
 * Markdown сами (react-markdown), поэтому разрешаем такие ссылки сами же.
 * `content_url` вложения ведёт напрямую на Redmine-хост без заголовка
 * авторизации (та же причина, что у скачивания вложений) - тянем через
 * авторизованный клиент и подставляем blob object URL.
 *
 * Тянет картинки, видео и аудио (по content_type) одним проходом при смене
 * списка вложений. Освобождает object URL при размонтировании/смене списка.
 *
 * Возвращает map `имя файла -> { url, kind }`, чтобы вызывающий выбрал тег
 * (`<img>` / `<video>` / `<audio>`).
 */
export function useAttachmentMediaUrls(
  client: RedmineClient | null,
  attachments: Attachment[] | undefined,
): Record<string, ResolvedMedia> {
  const [urls, setUrls] = useState<Record<string, ResolvedMedia>>({});

  useEffect(() => {
    const media = (attachments ?? [])
      .map((a) => ({ a, kind: mediaKind(a.content_type) }))
      .filter((x): x is { a: Attachment; kind: MediaKind } => x.kind !== null);

    if (!client || media.length === 0) {
      setUrls({});
      return;
    }

    let cancelled = false;
    const createdUrls: string[] = [];

    Promise.all(
      media.map(async ({ a, kind }) => {
        try {
          const { data } = await client.GET(
            "/attachments/download/{attachment_id}/{filename}",
            {
              params: {
                path: { attachment_id: a.id, filename: a.filename },
              },
              parseAs: "blob",
            },
          );
          if (!data) return null;
          const url = URL.createObjectURL(data as Blob);
          createdUrls.push(url);
          return [a.filename, { url, kind }] as const;
        } catch {
          return null;
        }
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setUrls(
        Object.fromEntries(
          pairs.filter((p): p is [string, ResolvedMedia] => p !== null),
        ),
      );
    });

    return () => {
      cancelled = true;
      createdUrls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, attachments]);

  return urls;
}
