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

export interface SidebarProps {
  /** Открыт ли выезжающий drawer на узких экранах (< lg). На lg+ игнорируется. */
  mobileOpen?: boolean
  /** Вызывается при переходе по пункту меню - чтобы вызывающий закрыл mobile drawer. */
  onNavigate?: () => void
}

/**
 * Темный левый сайдбар с иконками разделов - см. docs/design.md.
 *
 * - **lg и шире**: в потоке слева. Гамбургер-toggle переключает свернутый
 *   (иконки, `w-16`) и развернутый (`w-56`) режим, выбор в localStorage.
 * - **уже lg**: выезжающий поверх контента drawer (`fixed`, `w-64`), скрыт
 *   по умолчанию (`-translate-x-full`), открывается `mobileOpen` (гамбургер в
 *   Topbar). Backdrop и закрытие - на стороне AppShell.
 *
 * Активный пункт вычисляем сами через useLocation(), а не через функцию-пропс
 * NavLink#className - в свернутом состоянии пункт обернут в
 * `TooltipTrigger asChild`, а Radix Slot при мерже пропсов складывает
 * `className` через `[a, b].filter(Boolean).join(" ")`, ожидая строки; если
 * className - функция, в DOM утекает её исходный код вместо классов.
 */
export function Sidebar({ mobileOpen = false, onNavigate }: SidebarProps) {
  const [expanded, setExpanded] = useState(getInitialExpanded)
  const { pathname } = useLocation()

  function toggleExpanded() {
    setExpanded((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  // В drawer-режиме (узкий экран) подписи всегда видны - свёрнутый rail это
  // десктопная концепция.
  const showLabels = mobileOpen || expanded

  return (
    <aside
      className={cn(
        'z-50 flex h-svh shrink-0 flex-col gap-1 bg-sidebar py-3 text-sidebar-foreground',
        'transition-[width,transform] duration-200',
        // Мобильный drawer (< lg): фикс поверх контента, выезжает по mobileOpen.
        'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:w-64 max-lg:shadow-xl',
        mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full',
        // lg+: в потоке, ширина по expanded.
        'lg:static lg:translate-x-0',
        expanded ? 'lg:w-56' : 'lg:w-16',
        showLabels ? 'items-stretch px-2' : 'items-center',
      )}
    >
      <button
        type="button"
        aria-label="Свернуть/развернуть меню"
        aria-pressed={expanded}
        onClick={toggleExpanded}
        className={cn(
          'mb-4 flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
          // Кнопка сворачивания rail нужна только на lg+ (в drawer он всегда развёрнут).
          'max-lg:hidden',
          expanded && 'self-start',
        )}
      >
        <Menu className="size-5" />
      </button>

      <nav
        className={cn(
          'flex flex-1 flex-col gap-1',
          showLabels ? 'items-stretch' : 'items-center',
        )}
      >
        {navItems.map((item) => {
          const Icon = item.icon
          const content = item.path ? (
            <NavLink
              to={item.path}
              aria-label={item.label}
              onClick={() => onNavigate?.()}
              className={cn(
                itemBaseClasses,
                showLabels ? 'justify-start px-3' : 'w-10 justify-center',
                isPathActive(pathname, item.path) ? activeClasses : inactiveClasses,
              )}
            >
              <Icon className="size-5 shrink-0" />
              {showLabels && <span className="truncate text-sm">{item.label}</span>}
            </NavLink>
          ) : (
            <button
              type="button"
              aria-label={item.label}
              disabled
              className={cn(
                itemBaseClasses,
                showLabels ? 'justify-start px-3' : 'w-10 justify-center',
                'text-sidebar-foreground/30',
              )}
            >
              <Icon className="size-5 shrink-0" />
              {showLabels && <span className="truncate text-sm">{item.label}</span>}
            </button>
          )

          if (showLabels) {
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
