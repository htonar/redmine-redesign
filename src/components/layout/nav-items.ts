import {
  BarChart3,
  ClipboardList,
  Clock,
  Folder,
  Mail,
  PencilLine,
  Target,
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

/** Пункты левого сайдбара - см. docs/design.md, раздел "Компоненты, встреченные в макетах". */
export const navItems: NavItem[] = [
  { id: 'profile', label: 'Профиль', icon: User },
  { id: 'messages', label: 'Сообщения', icon: Mail },
  { id: 'time', label: 'Учет времени', icon: Clock },
  { id: 'activity', label: 'Активность', icon: BarChart3, path: '/dashboard' },
  { id: 'tasks', label: 'Задачи', icon: PencilLine, path: '/issues' },
  { id: 'reports', label: 'Отчеты', icon: ClipboardList },
  { id: 'goals', label: 'Цели', icon: Target },
  { id: 'files', label: 'Файлы', icon: Folder },
]
