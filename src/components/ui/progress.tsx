"use client";

import * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        // bg-muted почти сливался с фоном карточки (оба - близкие темные
        // оттенки в палитре, см. docs/design.md) - пустая дорожка на 0%
        // была практически невидима (найдено на аудите верстки). foreground/10
        // - тот же прием, что и у собственной рамки Card (ring-foreground/10),
        // гарантированно виден поверх любого фона в обеих темах.
        "relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-foreground/10",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        // duration-700 - дефолтный transition-all (150мс) практически
        // незаметен на изменении значения (мягкая геймификация, см.
        // CLAUDE.md); motion-reduce отключает анимацию для тех, кто попросил
        // браузер уменьшить движение.
        className="size-full flex-1 bg-primary transition-all duration-700 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
