import { useState } from "react";
import { Download, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { UploadFileDialog } from "@/components/files/UploadFileDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useFiles } from "@/hooks/useFiles";
import { useProjectVersions } from "@/hooks/useProjectVersions";
import { deleteFile, uploadFile, type ProjectFile } from "@/api/files";
import { loadCredentials } from "@/lib/auth-storage";
import { useLayoutContext } from "./AppLayout";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Скачивание идет напрямую на Redmine (не через наш прокси - обычная
 * навигация браузера не подчиняется CORS, в отличие от fetch/XHR), с
 * API-ключом в query-параметре `key` - это штатный механизм Redmine для
 * ссылок, которые не могут нести заголовки (см. официальную REST-вики,
 * тот же прием используется для ссылок на Atom-фиды). Ключ у себя в
 * localStorage мы и так храним - для обычной ссылки `<a href>` иначе
 * авторизоваться нечем. `content_url` от Redmine уже приходит абсолютным
 * (полный `http(s)://host/attachments/download/...`, не путь) - несмотря на
 * то что и в спеке, и по названию поля ожидался путь, добавлять baseUrl
 * спереди не нужно (проверено сквозным прогоном - с baseUrl адрес
 * задваивался).
 */
function downloadUrl(file: ProjectFile): string {
  const apiKey = loadCredentials()?.apiKey;
  const separator = file.content_url.includes("?") ? "&" : "?";
  return `${file.content_url}${apiKey ? `${separator}key=${apiKey}` : ""}`;
}

/**
 * Файлы проекта (Files-модуль Redmine, полностью покрыт в REST API - см.
 * CLAUDE.md, "Бэклог: пустые пункты сайдбара/топбара"). Список - только для
 * одного выбранного в Topbar проекта: агрегировать файлы across-project
 * значило бы N запросов на каждый проект без выигрыша - файлы и так привязаны
 * к конкретному проекту, странно показывать их вперемешку.
 */
export function FilesPage() {
  const { client, can } = useAuth();
  const { selectedProjectId } = useLayoutContext();
  const { files, isLoading, error, errorKind, reload } = useFiles(
    client,
    selectedProjectId,
  );
  const { versions } = useProjectVersions(client, selectedProjectId);
  const [deleteTarget, setDeleteTarget] = useState<ProjectFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canManage = can("manage_files", selectedProjectId);

  async function handleUpload(input: { file: File; description?: string; versionId?: number }) {
    if (!client || !selectedProjectId) return;
    await uploadFile(client, { ...input, projectId: selectedProjectId });
    reload();
  }

  async function handleDelete() {
    if (!client || !deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteFile(client, deleteTarget.id);
      setDeleteTarget(null);
      reload();
    } finally {
      setIsDeleting(false);
    }
  }

  if (!selectedProjectId) {
    return (
      <div className="rounded-lg border border-border bg-card py-8 text-center text-muted-foreground">
        Выберите проект в шапке, чтобы увидеть его файлы.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Файлы</h1>
        {canManage && (
          <UploadFileDialog
            versions={versions}
            onSubmit={handleUpload}
            trigger={
              <Button size="sm" className="gap-1.5">
                <Upload className="size-3.5" />
                Загрузить файл
              </Button>
            }
          />
        )}
      </div>

      {error && (
        <Alert variant={errorKind === "module-disabled" ? "default" : "destructive"}>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{error}</span>
            {errorKind !== "module-disabled" && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={reload}
              >
                Повторить
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Загрузка...
        </div>
      )}

      {!isLoading && files.length === 0 && !error && (
        <div className="rounded-lg border border-border bg-card py-8 text-center text-muted-foreground">
          В этом проекте пока нет файлов
        </div>
      )}

      {!isLoading && files.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Имя</TableHead>
                <TableHead>Версия</TableHead>
                <TableHead>Автор</TableHead>
                <TableHead>Загружен</TableHead>
                <TableHead className="text-right">Размер</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="font-medium">
                    {file.filename}
                    {file.description && (
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        {file.description}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {file.version?.name ?? "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {file.author?.name ?? "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(file.created_on)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatSize(file.filesize)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label="Скачать" asChild>
                        <a href={downloadUrl(file)} target="_blank" rel="noreferrer">
                          <Download className="size-3.5" />
                        </a>
                      </Button>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Удалить файл"
                          onClick={() => setDeleteTarget(file)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Удалить файл?"
        description={deleteTarget ? `«${deleteTarget.filename}» - действие необратимо.` : undefined}
        onConfirm={handleDelete}
        isConfirming={isDeleting}
      />
    </div>
  );
}
