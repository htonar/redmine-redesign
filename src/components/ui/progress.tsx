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
        // bg-muted почти сливался с фоном карточки (оба - близкие оттенки в
        // палитре, см. docs/design.md) - пустая дорожка на 0% была
        // практически невидима (issue #32). foreground/20 + чуть большая
        // высота: дорожка читается на любом фоне в обеих темах даже при 0%.
        "relative flex h-1.5 w-full items-center overflow-x-hidden rounded-full bg-foreground/20",
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
