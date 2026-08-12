import { ChevronDown, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface CurrentUser {
  name: string
  initials: string
}

export interface TopbarProps {
  projects: string[]
  currentProject: string
  onProjectChange: (project: string) => void
  user: CurrentUser
  onLogout: () => void
}

/** Верхняя панель рабочей области: поиск, переключатель проекта, пользователь. */
export function Topbar({
  projects,
  currentProject,
  onProjectChange,
  user,
  onLogout,
}: TopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card px-4">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Поиск..." className="pl-8" />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5">
              {currentProject}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {projects.map((project) => (
              <DropdownMenuItem
                key={project}
                onSelect={() => onProjectChange(project)}
              >
                {project}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

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
