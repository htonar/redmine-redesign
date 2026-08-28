import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";
import { FilesError, listFiles, type ProjectFile } from "@/api/files";

/** Файлы проекта (Files-модуль Redmine) - см. FilesPage. reload() после загрузки/удаления. */
export function useFiles(client: RedmineClient | null, projectId: number | null) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<
    "module-disabled" | "generic" | null
  >(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!client || !projectId) {
      setFiles([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setErrorKind(null);

    listFiles(client, projectId)
      .then((data) => {
        if (cancelled) return;
        setFiles(data);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Не удалось загрузить список файлов.");
        setErrorKind(e instanceof FilesError ? e.kind : "generic");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, projectId, reloadToken]);

  function reload() {
    setReloadToken((t) => t + 1);
  }

  return { files, isLoading, error, errorKind, reload };
}
