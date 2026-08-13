import { useMemo, useState } from "react";
import { Outlet, useNavigate, useOutletContext } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/AppShell";
import { CreateIssueDialog } from "@/components/issues/CreateIssueDialog";
import { HotkeysHelpDialog } from "@/components/layout/HotkeysHelpDialog";
import { UpdateBanner } from "@/components/layout/UpdateBanner";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useProjects } from "@/hooks/useProjects";
import { useGlobalHotkeys } from "@/hooks/useGlobalHotkeys";

interface LayoutContext {
  selectedProjectId: number | null;
  setSelectedProjectId: (projectId: number | null) => void;
}

function initials(firstname: string, lastname: string): string {
  return `${firstname[0] ?? ""}${lastname[0] ?? ""}`.toUpperCase();
}

/** Общий каркас авторизованной части приложения - сайдбар/топбар + текущий раздел. */
export function AppLayout() {
  const { user, client, baseUrl, can, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { projects, isLoading: projectsLoading } = useProjects(client);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null,
  );
  const navigate = useNavigate();
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [isHotkeysHelpOpen, setIsHotkeysHelpOpen] = useState(false);

  // Тот же фильтр по add_issues, что и кнопка "Добавить задачу" на IssuesPage
  // (см. docs/permissions.md) - хоткей "c" не должен подсовывать проект без прав.
  const creatableProjects = useMemo(
    () => projects.filter((p) => can("add_issues", p.id)),
    [projects, can],
  );

  useGlobalHotkeys({
    onNavigateIssues: () => navigate("/issues"),
    onNavigateDashboard: () => navigate("/dashboard"),
    onNavigateTime: () => navigate("/time"),
    onCreateIssue:
      creatableProjects.length > 0
        ? () => setIsCreateIssueOpen(true)
        : undefined,
    onFocusSearch: () =>
      document
        .querySelector<HTMLInputElement>('[data-slot="command-input"]')
        ?.focus(),
    onShowHelp: () => setIsHotkeysHelpOpen(true),
  });

  if (!user) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <AppShell
        client={client}
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
        onShowHotkeysHelp={() => setIsHotkeysHelpOpen(true)}
      >
        <Outlet
          context={
            { selectedProjectId, setSelectedProjectId } satisfies LayoutContext
          }
        />
      </AppShell>
      {/* Глобальный диалог создания задачи для хоткея "c" - без trigger, только open/onOpenChange. */}
      <CreateIssueDialog
        client={client}
        projects={creatableProjects}
        defaultProjectId={selectedProjectId}
        currentUser={user}
        baseUrl={baseUrl}
        open={isCreateIssueOpen}
        onOpenChange={setIsCreateIssueOpen}
        onCreated={(issue) => {
          setIsCreateIssueOpen(false);
          navigate(`/issues/${issue.id}`);
        }}
      />
      <HotkeysHelpDialog
        open={isHotkeysHelpOpen}
        onOpenChange={setIsHotkeysHelpOpen}
      />
      {/* Автообновление (только десктоп-сборка) - сама себя скрывает в вебе. */}
      <UpdateBanner />
    </TooltipProvider>
  );
}

/** Текущий выбранный в Topbar проект - читается со страниц внутри AppLayout. */
export function useLayoutContext(): LayoutContext {
  return useOutletContext<LayoutContext>();
}
