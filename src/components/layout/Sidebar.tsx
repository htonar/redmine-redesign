import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { navItems } from './nav-items'

export interface SidebarProps {
  activeId: string
  onNavigate: (id: string) => void
}

/**
 * Тёмный левый сайдбар с иконками разделов - см. docs/design.md.
 * Только иконки (без подписей), подпись показывается в tooltip при наведении.
 */
export function Sidebar({ activeId, onNavigate }: SidebarProps) {
  return (
    <aside className="flex h-svh w-16 shrink-0 flex-col items-center gap-1 bg-sidebar py-3 text-sidebar-foreground">
      <button
        type="button"
        aria-label="Свернуть/развернуть меню"
        className="mb-4 flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        <Menu className="size-5" />
      </button>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {navItems.map((item) => {
          const isActive = item.id === activeId
          const Icon = item.icon
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    'flex size-10 items-center justify-center rounded-lg transition-colors',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <Icon className="size-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          )
        })}
      </nav>
    </aside>
  )
}
