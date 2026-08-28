import { useEffect, useState, type PropsWithChildren } from "react";
import { useLocation } from "react-router";
import { Sidebar } from "./Sidebar";
import { Topbar, type CurrentUser, type TopbarProps } from "./Topbar";

export interface AppShellProps
  extends PropsWithChildren, Omit<TopbarProps, "user" | "onOpenNav"> {
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
  timerSlot,
}: AppShellProps) {
  // Мобильный drawer сайдбара (< lg). На lg+ сайдбар всегда в потоке.
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();

  // Закрывать drawer при смене раздела и по Escape.
  useEffect(() => setNavOpen(false), [pathname]);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  return (
    <div className="flex h-svh bg-background text-foreground">
      <Sidebar mobileOpen={navOpen} onNavigate={() => setNavOpen(false)} />

      {navOpen && (
        <button
          type="button"
          aria-label="Закрыть меню"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

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
          onOpenNav={() => setNavOpen(true)}
          timerSlot={timerSlot}
        />
        <main className="flex-1 overflow-auto bg-muted/40 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
