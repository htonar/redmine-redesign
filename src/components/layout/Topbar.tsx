import { ChevronDown, Moon, Search, Sun } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Project } from '@/hooks/useProjects'
import { getGravatarUrl } from '@/lib/gravatar'

export interface CurrentUser {
  name: string
  initials: string
  email: string
}

export interface TopbarProps {
  projects: Project[]
  projectsLoading: boolean
  /** null - фильтр "Все проекты". */
  selectedProjectId: number | null
  onProjectChange: (projectId: number | null) => void
  user: CurrentUser
  onLogout: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

/** Верхняя панель рабочей области: поиск, переключатель проекта, пользователь. */
export function Topbar({
  projects,
  projectsLoading,
  selectedProjectId,
  onProjectChange,
  user,
  onLogout,
  theme,
  onToggleTheme,
}: TopbarProps) {
  const currentProjectName =
    projects.find((p) => p.id === selectedProjectId)?.name ?? 'Все проекты'

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card px-4">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Поиск..." className="pl-8" />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              disabled={projectsLoading}
            >
              {projectsLoading ? 'Загрузка...' : currentProjectName}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onProjectChange(null)}>
              Все проекты
            </DropdownMenuItem>
            {projects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onSelect={() => onProjectChange(project.id)}
              >
                {project.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-accent"
            >
              <span className="text-sm font-medium">{user.name}</span>
              <Avatar className="size-8">
                <AvatarImage src={getGravatarUrl(user.email, 64)} alt={user.name} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user.initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Профиль</DropdownMenuItem>
            <DropdownMenuItem>Настройки</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onLogout}>
              Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
