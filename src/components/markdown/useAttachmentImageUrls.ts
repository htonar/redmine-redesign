import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";
import type { Attachment } from "@/api/attachments";

/**
 * Redmine резолвит `![](filename.png)` в тексте задачи/комментария в
 * прикреплённый файл с таким именем сам, на своей стороне, при рендере
 * собственного HTML - но мы рендерим Markdown сами (react-markdown), поэтому
 * должны разрешать такие ссылки сами же. `content_url` вложения ведёт
 * напрямую на Redmine-хост без заголовка авторизации (та же причина, что и у
 * скачивания вложений, см. downloadAttachment) - картинки, а не только
 * скачивание по клику, тоже нужно тянуть через авторизованный клиент и
 * подставлять blob object URL.
 *
 * Тянет только картиночные вложения (по content_type), одним проходом при
 * смене списка вложений - не по требованию на каждый рендер. Освобождает
 * object URL при размонтировании/смене списка.
 */
export function useAttachmentImageUrls(
  client: RedmineClient | null,
  attachments: Attachment[] | undefined,
): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const images = (attachments ?? []).filter((a) =>
      a.content_type?.startsWith("image/"),
    );
    if (!client || images.length === 0) {
      setUrls({});
      return;
    }

    let cancelled = false;
    const createdUrls: string[] = [];

    Promise.all(
      images.map(async (a) => {
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
          return [a.filename, url] as const;
        } catch {
          return null;
        }
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setUrls(
        Object.fromEntries(
          pairs.filter((p): p is [string, string] => p !== null),
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
