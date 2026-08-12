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
}

/** Пункты левого сайдбара - см. docs/design.md, раздел "Компоненты, встреченные в макетах". */
export const navItems: NavItem[] = [
  { id: 'profile', label: 'Профиль', icon: User },
  { id: 'messages', label: 'Сообщения', icon: Mail },
  { id: 'time', label: 'Учет времени', icon: Clock },
  { id: 'activity', label: 'Активность', icon: BarChart3 },
  { id: 'tasks', label: 'Задачи', icon: PencilLine },
  { id: 'reports', label: 'Отчеты', icon: ClipboardList },
  { id: 'goals', label: 'Цели', icon: Target },
  { id: 'files', label: 'Файлы', icon: Folder },
]
