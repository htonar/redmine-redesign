import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /**
   * "default" - крупные секции целиком (список задач, канбан-доска, записи
   * времени). "compact" - инлайн-места внутри карточки (подзадачи, связи,
   * вложения, наблюдатели на карточке задачи), где нет места под отступы и
   * иконку в полный рост.
   */
  size?: "default" | "compact";
  className?: string;
}

/**
 * Единообразная подача "здесь пока ничего нет" - вместо разнобоя вроде
 * `<p>Нет</p>` в одних местах и произвольного текста в других (issue #8).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "default",
  className,
}: EmptyStateProps) {
  const isCompact = size === "compact";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        isCompact ? "gap-1 py-1" : "gap-2 py-10",
        className,
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            "text-muted-foreground/60",
            isCompact ? "size-4" : "size-8",
          )}
        />
      )}
      <p
        className={cn(
          "text-muted-foreground",
          isCompact ? "text-sm" : "text-sm font-medium",
        )}
      >
        {title}
      </p>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
