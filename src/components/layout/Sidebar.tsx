import { Menu } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { navItems } from './nav-items'

const STORAGE_KEY = 'redmine-sidebar-expanded'

const itemBaseClasses =
  'flex h-10 items-center gap-3 rounded-lg transition-colors'
const inactiveClasses =
  'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
const activeClasses = 'bg-sidebar-primary text-sidebar-primary-foreground'

function getInitialExpanded(): boolean {
  return localStorage.getItem(STORAGE_KEY) === '1'
}

/** Активен ли пункт меню для текущего пути (сам путь или его подстраницы, например /issues/42). */
function isPathActive(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`)
}

/**
 * Темный левый сайдбар с иконками разделов - см. docs/design.md. Пункты без
 * `path` в nav-items.ts еще не реализованы - показаны, но неактивны.
 *
 * Гамбургер-toggle переключает свернутый (иконки без подписей, w-16) и
 * развернутый (подписи рядом с иконками, w-56) режим - выбор сохраняется в
 * localStorage, по образцу ThemeContext. В развернутом виде подпись уже
 * видна рядом с иконкой, поэтому Tooltip не нужен - показываем его только в
 * свернутом состоянии.
 *
 * Активный пункт вычисляем сами через useLocation(), а не через функцию-пропс
 * NavLink#className - в свернутом состоянии пункт обернут в
 * `TooltipTrigger asChild`, а Radix Slot при мерже пропсов складывает
 * `className` через `[a, b].filter(Boolean).join(" ")`, ожидая строки; если
 * className - функция (как у NavLink по умолчанию), join молча приводит её к
 * строке через toString() - в DOM утекает исходный код функции вместо
 * классов, а подсветка активного пункта перестаёт работать. Это баг,
 * унаследованный от исходного кода (Tooltip оборачивал NavLink с
 * className-функцией и там же), просто раньше не был замечен - подсветка не
 * работала ни в одном состоянии сайдбара.
 */
export function Sidebar() {
  const [expanded, setExpanded] = useState(getInitialExpanded)
  const { pathname } = useLocation()

  function toggleExpanded() {
    setExpanded((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  return (
    <aside
      className={cn(
        'flex h-svh shrink-0 flex-col gap-1 bg-sidebar py-3 text-sidebar-foreground transition-[width] duration-200',
        expanded ? 'w-56 items-stretch px-2' : 'w-16 items-center',
      )}
    >
      <button
        type="button"
        aria-label="Свернуть/развернуть меню"
        aria-pressed={expanded}
        onClick={toggleExpanded}
        className={cn(
          'mb-4 flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
          expanded && 'self-start',
        )}
      >
        <Menu className="size-5" />
      </button>

      <nav
        className={cn(
          'flex flex-1 flex-col gap-1',
          expanded ? 'items-stretch' : 'items-center',
        )}
      >
        {navItems.map((item) => {
          const Icon = item.icon
          const content = item.path ? (
            <NavLink
              to={item.path}
              aria-label={item.label}
              className={cn(
                itemBaseClasses,
                expanded ? 'justify-start px-3' : 'w-10 justify-center',
                isPathActive(pathname, item.path) ? activeClasses : inactiveClasses,
              )}
            >
              <Icon className="size-5 shrink-0" />
              {expanded && <span className="truncate text-sm">{item.label}</span>}
            </NavLink>
          ) : (
            <button
              type="button"
              aria-label={item.label}
              disabled
              className={cn(
                itemBaseClasses,
                expanded ? 'justify-start px-3' : 'w-10 justify-center',
                'text-sidebar-foreground/30',
              )}
            >
              <Icon className="size-5 shrink-0" />
              {expanded && <span className="truncate text-sm">{item.label}</span>}
            </button>
          )

          if (expanded) {
            return <div key={item.id}>{content}</div>
          }

          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>{content}</TooltipTrigger>
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
