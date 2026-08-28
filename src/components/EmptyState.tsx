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
        "flex flex-col justify-center",
        // compact - инлайн внутри карточки: по левому краю, минимум отступов,
        // чтобы пустые секции не смотрелись громоздко. default - по центру.
        isCompact
          ? "items-start gap-1 py-0.5 text-left"
          : "items-center gap-2 py-10 text-center",
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
