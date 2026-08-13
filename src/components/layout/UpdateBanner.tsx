import { DownloadCloud, Loader2, X } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAppUpdater } from "@/hooks/useAppUpdater";

/**
 * Плавающий баннер "доступно обновление" - только десктоп-сборка (Tauri),
 * см. useAppUpdater.ts. Ничего не рендерит в веб-сборке (`supported ===
 * false`) и молчит, пока обновления нет ("idle"/"checking"/"none") - не
 * дергаем пользователя без повода.
 *
 * Смонтирован один раз в AppLayout.tsx, по образцу HotkeysHelpDialog -
 * общий для всего приложения элемент, не завязан на конкретную страницу.
 */
export function UpdateBanner() {
  const { supported, status, availableVersion, error, installUpdate } =
    useAppUpdater();
  const [dismissed, setDismissed] = useState(false);

  if (!supported || dismissed) return null;
  if (status !== "available" && status !== "downloading" && status !== "installing" && status !== "error") {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Alert variant={status === "error" ? "destructive" : "default"} className="shadow-lg">
        {status === "downloading" || status === "installing" ? (
          <Loader2 className="animate-spin" />
        ) : (
          <DownloadCloud />
        )}
        <AlertTitle>
          {status === "error"
            ? "Не удалось обновить"
            : status === "downloading"
              ? "Загрузка обновления..."
              : status === "installing"
                ? "Установка, приложение перезапустится..."
                : `Доступна версия ${availableVersion}`}
        </AlertTitle>
        <AlertDescription>
          {status === "error" ? (
            error
          ) : status === "available" ? (
            <div className="mt-1 flex gap-2">
              <Button size="sm" onClick={installUpdate}>
                Обновить и перезапустить
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
                Позже
              </Button>
            </div>
          ) : null}
        </AlertDescription>
        {status !== "downloading" && status !== "installing" && (
          <button
            type="button"
            aria-label="Закрыть"
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
            onClick={() => setDismissed(true)}
          >
            <X className="size-4" />
          </button>
        )}
      </Alert>
    </div>
  );
}
