import type { PropsWithChildren } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar, type CurrentUser } from './Topbar'

export interface AppShellProps extends PropsWithChildren {
  activeNavId: string
  onNavigate: (id: string) => void
  projects: string[]
  currentProject: string
  onProjectChange: (project: string) => void
  user: CurrentUser
  onLogout: () => void
}

/** Общий каркас: тёмный сайдбар слева + топ-бар и контент справа. */
export function AppShell({
  children,
  activeNavId,
  onNavigate,
  projects,
  currentProject,
  onProjectChange,
  user,
  onLogout,
}: AppShellProps) {
  return (
    <div className="flex h-svh bg-background text-foreground">
      <Sidebar activeId={activeNavId} onNavigate={onNavigate} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          projects={projects}
          currentProject={currentProject}
          onProjectChange={onProjectChange}
          user={user}
          onLogout={onLogout}
        />
        <main className="flex-1 overflow-auto bg-muted/40 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
