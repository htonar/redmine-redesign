import { BarChart3, Clock, Folder, PencilLine, PieChart, Settings, User, type LucideIcon } from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  /** Путь роута - если не задан, раздел еще не реализован (пункт неактивен). */
  path?: string
}

/**
 * Пункты левого сайдбара - см. docs/design.md, раздел "Компоненты, встреченные
 * в макетах". "Сообщения" и "Цели" из референса сюда сознательно не входят -
 * решили вырезать их до появления ясности, что каждый из них значит в нашем
 * случае (см. CLAUDE.md, "Бэклог: пустые пункты сайдбара/топбара"). "Отчеты"
 * реализованы (GitHub issue #13) - сводка по задачам выбранного проекта.
 */
export const navItems: NavItem[] = [
  { id: 'profile', label: 'Профиль', icon: User, path: '/profile' },
  { id: 'time', label: 'Учет времени', icon: Clock, path: '/time' },
  { id: 'activity', label: 'Активность', icon: BarChart3, path: '/dashboard' },
  { id: 'tasks', label: 'Задачи', icon: PencilLine, path: '/issues' },
  { id: 'files', label: 'Файлы', icon: Folder, path: '/files' },
  { id: 'reports', label: 'Отчеты', icon: PieChart, path: '/reports' },
  { id: 'settings', label: 'Настройки', icon: Settings, path: '/settings' },
]
