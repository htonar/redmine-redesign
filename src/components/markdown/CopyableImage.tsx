import { Check, Copy, X } from "lucide-react";
import { useState } from "react";
import { copyImageToClipboard } from "@/lib/copy-image";
import { cn } from "@/lib/utils";

type CopyState = "idle" | "ok" | "err";

export interface CopyableImageProps {
  src: string;
  alt: string;
  title?: string;
  style?: React.CSSProperties;
  /**
   * Байты картинки для копирования в буфер как изображения. Без них кнопка
   * копирования не показывается - у внешних `src` пользователь и так может
   * скопировать картинку правым кликом (issue #67).
   */
  blob?: Blob;
}

/**
 * Картинка из вложения задачи с кнопкой "скопировать" по ховеру. Правый клик
 * по такой картинке в webview копировал `blob:tauri://localhost/<uuid>` -
 * бесполезную строку; кнопка кладёт в буфер настоящее изображение
 * (issue #67).
 */
export function CopyableImage({
  src,
  alt,
  title,
  style,
  blob,
}: CopyableImageProps) {
  const [state, setState] = useState<CopyState>("idle");

  async function handleCopy() {
    if (!blob) return;
    try {
      await copyImageToClipboard(blob);
      setState("ok");
    } catch {
      setState("err");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  const Icon = state === "ok" ? Check : state === "err" ? X : Copy;

  return (
    <span className="group relative inline-block">
      <img
        src={src}
        alt={alt}
        title={title}
        style={style}
        className="rounded-lg border border-border"
      />
      {blob && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Скопировать картинку"
          title={
            state === "ok"
              ? "Скопировано"
              : state === "err"
                ? "Не удалось скопировать"
                : "Скопировать картинку"
          }
          className={cn(
            "absolute right-2 top-2 rounded-md border border-border bg-background/80 p-1.5 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100",
            state === "ok" && "text-emerald-600 opacity-100 dark:text-emerald-400",
            state === "err" && "text-red-600 opacity-100 dark:text-red-400",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      )}
    </span>
  );
}
