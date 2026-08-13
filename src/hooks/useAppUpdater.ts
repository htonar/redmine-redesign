import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/**
 * Автообновление десктоп-сборки (Tauri), GitHub issue #2.
 *
 * Работает только внутри Tauri (`isTauri()`) - в веб-сборке (Vite dev/prod,
 * Docker) этот хук не делает ничего, `status` остается "idle" навсегда. В
 * вебе обновление - это просто обновление страницы, у него нет отдельного
 * бинарника, который нужно скачивать/подписывать.
 *
 * `check()` дергает endpoint из tauri.conf.json
 * (`plugins.updater.endpoints`) - у нас это
 * `github.com/.../releases/latest/download/latest.json`, который появляется
 * только когда релиз в GitHub Releases **опубликован** (не draft) - CI
 * (`desktop-release.yml`) всегда создает релизы как draft, так что
 * автопроверка не увидит новую версию, пока кто-то не нажмет "Publish"
 * вручную. Это осознанное поведение, не баг - см. CLAUDE.md, "Бэклог:
 * паковка... GitHub Actions".
 */

export type AppUpdaterStatus =
  | "idle"
  | "checking"
  | "none"
  | "available"
  | "downloading"
  | "installing"
  | "error";

export interface UseAppUpdaterResult {
  /** Доступно только внутри десктоп-сборки - в вебе всегда false. */
  supported: boolean;
  status: AppUpdaterStatus;
  /** Версия из manifest'а, если найдено обновление. */
  availableVersion: string | null;
  /** Текст релиза (releaseBody из CI) - markdown/plain text от GitHub. */
  releaseNotes: string | null;
  error: string | null;
  /** Ручная проверка (кнопка "Проверить обновления"). */
  checkForUpdate: () => void;
  /** Скачивает и устанавливает найденное обновление, затем перезапускает приложение. */
  installUpdate: () => void;
}

export function useAppUpdater(): UseAppUpdaterResult {
  const supported = isTauri();
  const [status, setStatus] = useState<AppUpdaterStatus>("idle");
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Сам объект Update (нужен install()) не кладем в state - он не
  // сериализуем красиво и не нужен для рендера, только installUpdate().
  const pendingUpdateRef = useRef<Update | null>(null);

  const checkForUpdate = useCallback(() => {
    if (!supported) return;
    setStatus("checking");
    setError(null);
    check()
      .then((update) => {
        if (update) {
          pendingUpdateRef.current = update;
          setAvailableVersion(update.version);
          setReleaseNotes(update.body ?? null);
          setStatus("available");
        } else {
          pendingUpdateRef.current = null;
          setStatus("none");
        }
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Не удалось проверить обновления.");
        setStatus("error");
      });
  }, [supported]);

  const installUpdate = useCallback(() => {
    const update = pendingUpdateRef.current;
    if (!update) return;
    setStatus("downloading");
    setError(null);
    update
      .downloadAndInstall()
      .then(async () => {
        setStatus("installing");
        await relaunch();
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Не удалось установить обновление.");
        setStatus("error");
      });
  }, []);

  // Автопроверка один раз при старте приложения (только Tauri), без
  // повторов по таймеру - пользователь и так открывает приложение не
  // ежеминутно, а лишний фоновый поллинг ничего не выигрывает.
  useEffect(() => {
    if (!supported) return;
    checkForUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  return {
    supported,
    status,
    availableVersion,
    releaseNotes,
    error,
    checkForUpdate,
    installUpdate,
  };
}
