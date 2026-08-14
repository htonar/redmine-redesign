import type { RedmineClient } from "@/api/client";
import type { components } from "@/api/schema";
import { downloadBlob } from "@/lib/blob-download";

export type Attachment = components["schemas"]["attachment"];

export interface UploadedFile {
  token: string;
  filename: string;
  contentType?: string;
}

/**
 * Загружает байты файла в Redmine (`POST /uploads`) и возвращает token -
 * его нужно передать в `uploads` при создании/правке задачи (см.
 * IssueFieldsInput.uploads в src/api/issues.ts), чтобы реально прикрепить
 * файл к задаче. Сама по себе загрузка задачу не меняет - это двухшаговый
 * процесс, как описано в Redmine REST API docs ("Attaching files").
 *
 * Тело запроса - сырые байты файла, не JSON, поэтому передаем свой
 * bodySerializer (без сериализации) и явный Content-Type - client.ts не
 * перетирает его, если он уже задан (см. комментарий там).
 *
 * Content-Type самого запроса должен быть строго "application/octet-stream" -
 * реальный MIME-тип файла передается отдельно через query-параметр
 * content_type. Если вместо этого поставить в заголовок сам file.type
 * (например "text/plain"), Redmine отвечает 406 Not Acceptable - похоже,
 * Rails-роутинг для .json-формата конфликтует с "не-бинарным" Content-Type
 * запроса. Проверено вручную (сырой fetch мимо клиента, в обход этого файла):
 * тот же запрос с Content-Type: text/plain -> 406, с application/octet-stream
 * -> 201.
 */
export async function uploadAttachment(
  client: RedmineClient,
  file: File,
): Promise<UploadedFile> {
  const { data, error } = await client.POST("/uploads.{format}", {
    params: {
      path: { format: "json" },
      query: { filename: file.name, content_type: file.type || undefined },
    },
    // @ts-expect-error - схема типизирует тело как `string`/binary, а не как File;
    // фактически openapi-fetch просто передает body как есть в fetch().
    body: file,
    bodySerializer: (body: unknown) => body,
    headers: { "Content-Type": "application/octet-stream" },
  });

  if (error || !data) {
    throw new Error(`Не удалось загрузить файл "${file.name}".`);
  }

  return { token: data.upload.token, filename: file.name, contentType: file.type || undefined };
}

/**
 * Тянет сырые байты вложения через тот же (прокси-осведомленный,
 * авторизованный) клиент, а не прямой `<a href={attachment.content_url}>` -
 * content_url ведет напрямую на Redmine-хост, простая навигация браузера не
 * понесет заголовок X-Redmine-API-Key, а сам Redmine обычно требует
 * авторизацию даже на скачивание. Общий кусок для быстрого скачивания
 * (downloadAttachment) и предпросмотра (AttachmentPreviewDialog), которому
 * нужен сам blob, а не немедленный клик по <a download>.
 */
export async function fetchAttachmentBlob(
  client: RedmineClient,
  attachment: Attachment,
): Promise<Blob> {
  const { data, error } = await client.GET("/attachments/download/{attachment_id}/{filename}", {
    params: { path: { attachment_id: attachment.id, filename: attachment.filename } },
    parseAs: "blob",
  });

  if (error || !data) {
    throw new Error(`Не удалось загрузить файл "${attachment.filename}".`);
  }

  return data as Blob;
}

export async function downloadAttachment(
  client: RedmineClient,
  attachment: Attachment,
): Promise<void> {
  const blob = await fetchAttachmentBlob(client, attachment);
  downloadBlob(blob, attachment.filename);
}

/** Удаление уже прикрепленного файла - по id самого вложения. */
export async function deleteAttachment(client: RedmineClient, attachmentId: number): Promise<void> {
  const { error } = await client.DELETE("/attachments/{attachment_id}.{format}", {
    params: { path: { format: "json", attachment_id: attachmentId } },
  });

  if (error) {
    throw new Error("Не удалось удалить файл.");
  }
}
