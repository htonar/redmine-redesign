import { useState } from "react";
import { Outlet, useOutletContext } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useProjects } from "@/hooks/useProjects";

interface LayoutContext {
  selectedProjectId: number | null;
  setSelectedProjectId: (projectId: number | null) => void;
}

function initials(firstname: string, lastname: string): string {
  return `${firstname[0] ?? ""}${lastname[0] ?? ""}`.toUpperCase();
}

/** Общий каркас авторизованной части приложения - сайдбар/топбар + текущий раздел. */
export function AppLayout() {
  const { user, client, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { projects, isLoading: projectsLoading } = useProjects(client);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  if (!user) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <AppShell
        projects={projects}
        projectsLoading={projectsLoading}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
        user={{
          name: `${user.firstname} ${user.lastname}`,
          initials: initials(user.firstname, user.lastname),
          email: user.mail,
        }}
        onLogout={logout}
        theme={theme}
        onToggleTheme={toggleTheme}
      >
        <Outlet
          context={{ selectedProjectId, setSelectedProjectId } satisfies LayoutContext}
        />
      </AppShell>
    </TooltipProvider>
  );
}

/** Текущий выбранный в Topbar проект - читается со страниц внутри AppLayout. */
export function useLayoutContext(): LayoutContext {
  return useOutletContext<LayoutContext>();
}
