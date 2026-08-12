import {
  BarChart3,
  ClipboardList,
  Clock,
  PencilLine,
  User,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  /** Путь роута - если не задан, раздел еще не реализован (пункт неактивен). */
  path?: string
}

/**
 * Пункты левого сайдбара - см. docs/design.md, раздел "Компоненты, встреченные
 * в макетах". Список сверен с пользователем: "Сообщения" (форумы), "Файлы"
 * (files-модуль) и "Цели" (не сущность Redmine вообще, декоративный пункт
 * исходного макета) сознательно убраны - фокус на разработчике, который
 * заводит задачи и трекает время, а не на паритете со всеми модулями
 * нативного Redmine. "Профиль" и "Отчеты" остаются в бэклоге, но не в
 * приоритете - см. CLAUDE.md.
 */
export const navItems: NavItem[] = [
  { id: 'profile', label: 'Профиль', icon: User },
  { id: 'time', label: 'Учет времени', icon: Clock, path: '/time' },
  { id: 'activity', label: 'Активность', icon: BarChart3, path: '/dashboard' },
  { id: 'tasks', label: 'Задачи', icon: PencilLine, path: '/issues' },
  { id: 'reports', label: 'Отчеты', icon: ClipboardList },
]
