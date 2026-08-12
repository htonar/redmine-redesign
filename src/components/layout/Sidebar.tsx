import { Menu } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { navItems } from './nav-items'

const itemClasses =
  'flex size-10 items-center justify-center rounded-lg transition-colors'
const inactiveClasses =
  'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
const activeClasses = 'bg-sidebar-primary text-sidebar-primary-foreground'

/**
 * Темный левый сайдбар с иконками разделов - см. docs/design.md. Пункты без
 * `path` в nav-items.ts еще не реализованы - показаны, но неактивны.
 */
export function Sidebar() {
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
          const Icon = item.icon
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                {item.path ? (
                  <NavLink
                    to={item.path}
                    aria-label={item.label}
                    className={({ isActive }) =>
                      cn(itemClasses, isActive ? activeClasses : inactiveClasses)
                    }
                  >
                    <Icon className="size-5" />
                  </NavLink>
                ) : (
                  <button
                    type="button"
                    aria-label={item.label}
                    disabled
                    className={cn(itemClasses, 'text-sidebar-foreground/30')}
                  >
                    <Icon className="size-5" />
                  </button>
                )}
              </TooltipTrigger>
              <TooltipContent side="right">
                {item.label}
                {!item.path && ' - скоро'}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </nav>
    </aside>
  )
}
