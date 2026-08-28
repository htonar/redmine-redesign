import type { RedmineClient } from "@/api/client";
import type { components } from "@/api/schema";

export type ProjectFile = components["schemas"]["file"];

/** kind: "module-disabled" - у проекта выключен модуль "Файлы" (403/404). */
export class FilesError extends Error {
  kind: "module-disabled" | "generic";
  constructor(kind: "module-disabled" | "generic", message: string) {
    super(message);
    this.name = "FilesError";
    this.kind = kind;
  }
}

export async function listFiles(client: RedmineClient, projectId: number): Promise<ProjectFile[]> {
  const { data, error, response } = await client.GET(
    "/projects/{project_id}/files.{format}",
    {
      params: { path: { format: "json", project_id: projectId } },
    },
  );

  if (error || !data) {
    if (response?.status === 403 || response?.status === 404) {
      throw new FilesError(
        "module-disabled",
        "В этом проекте выключен модуль «Файлы». Включите его в настройках проекта в Redmine.",
      );
    }
    throw new FilesError("generic", "Не удалось загрузить список файлов.");
  }

  return data.files;
}

export interface UploadFileInput {
  projectId: number;
  file: File;
  description?: string;
  versionId?: number;
}

/**
 * Загрузка файла в проект - двухэтапный процесс (см. официальную вики Redmine
 * REST Files): сначала сырой `POST /uploads.json` с бинарным телом (не JSON,
 * поэтому не через типизированный client.POST - см. client.rawFetch в
 * src/api/client.ts), в ответ приходит `token`; потом этот token уходит в
 * обычный JSON `POST /projects/{id}/files.json`, который уже создает запись
 * о файле в проекте.
 */
export async function uploadFile(client: RedmineClient, input: UploadFileInput): Promise<void> {
  const uploadRes = await client.rawFetch(
    `/uploads.json?filename=${encodeURIComponent(input.file.name)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: input.file,
    },
  );

  if (!uploadRes.ok) {
    throw new Error("Не удалось загрузить файл.");
  }

  const { upload } = (await uploadRes.json()) as { upload: { token: string } };

  const { error } = await client.POST("/projects/{project_id}/files.{format}", {
    params: { path: { format: "json", project_id: input.projectId } },
    body: {
      file: {
        token: upload.token,
        filename: input.file.name,
        description: input.description || undefined,
        version_id: input.versionId,
      },
    },
  });

  if (error) {
    throw new Error("Файл загружен, но не удалось прикрепить его к проекту.");
  }
}

export async function deleteFile(client: RedmineClient, attachmentId: number): Promise<void> {
  const { error } = await client.DELETE("/attachments/{attachment_id}.{format}", {
    params: { path: { format: "json", attachment_id: attachmentId } },
  });

  if (error) {
    throw new Error("Не удалось удалить файл.");
  }
}
