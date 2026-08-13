import { ChevronDown, Moon, Sun } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { GlobalSearch } from '@/components/layout/GlobalSearch'
import type { Project } from '@/hooks/useProjects'
import type { RedmineClient } from '@/api/client'

export interface CurrentUser {
  name: string
  initials: string
}

export interface TopbarProps {
  client: RedmineClient | null
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
  client,
  projects,
  projectsLoading,
  selectedProjectId,
  onProjectChange,
  user,
  onLogout,
  theme,
  onToggleTheme,
}: TopbarProps) {
  const navigate = useNavigate()
  const currentProjectName =
    projects.find((p) => p.id === selectedProjectId)?.name ?? 'Все проекты'

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card px-4">
      <div className="w-full max-w-sm">
        <GlobalSearch client={client} />
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
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user.initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => navigate('/profile')}>Профиль</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onLogout}>
              Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
