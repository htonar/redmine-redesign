import type { PropsWithChildren } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar, type CurrentUser, type TopbarProps } from "./Topbar";

export interface AppShellProps
  extends PropsWithChildren, Omit<TopbarProps, "user"> {
  user: CurrentUser;
}

/** Общий каркас: темный сайдбар слева + топ-бар и контент справа. */
export function AppShell({
  children,
  client,
  projects,
  projectsLoading,
  selectedProjectId,
  onProjectChange,
  user,
  onLogout,
  theme,
  onToggleTheme,
  onShowHotkeysHelp,
  notifications,
}: AppShellProps) {
  return (
    <div className="flex h-svh bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          client={client}
          projects={projects}
          projectsLoading={projectsLoading}
          selectedProjectId={selectedProjectId}
          onProjectChange={onProjectChange}
          user={user}
          onLogout={onLogout}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onShowHotkeysHelp={onShowHotkeysHelp}
          notifications={notifications}
        />
        <main className="flex-1 overflow-auto bg-muted/40 p-6">{children}</main>
      </div>
    </div>
  );
}
