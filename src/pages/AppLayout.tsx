import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate, useOutletContext } from "react-router";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/AppShell";
import { CreateIssueDialog } from "@/components/issues/CreateIssueDialog";
import { LogTimeDialog } from "@/components/time/LogTimeDialog";
import { HotkeysHelpDialog } from "@/components/layout/HotkeysHelpDialog";
import { UpdateBanner } from "@/components/layout/UpdateBanner";
import { NotificationSettingsDialog } from "@/components/layout/NotificationSettingsDialog";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useProjects } from "@/hooks/useProjects";
import { useGlobalHotkeys } from "@/hooks/useGlobalHotkeys";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useNotifications } from "@/hooks/useNotifications";
import { useTimeEntryActivities } from "@/hooks/useTimeEntryActivities";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/lib/notifications";
import { syncTrayBadge } from "@/lib/tray";
import { createTimeEntry } from "@/api/timeEntries";

/** Событие из меню трея (см. src-tauri/src/tray.rs, LOG_TIME_EVENT). */
const TRAY_LOG_TIME_EVENT = "tray://log-time";

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
  const [selectedProjectId, setSelectedProjectId] = usePersistedState<number | null>(
    baseUrl,
    user?.id,
    "selected-project",
    null,
  );
  const [notificationSettings, setNotificationSettings] = usePersistedState(
    baseUrl,
    user?.id,
    "notification-settings",
    DEFAULT_NOTIFICATION_SETTINGS,
  );
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(
    client,
    baseUrl,
    user?.id,
    notificationSettings,
  );
  const { activities } = useTimeEntryActivities(client);
  const navigate = useNavigate();
  const location = useLocation();
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [isHotkeysHelpOpen, setIsHotkeysHelpOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);
  const [isTrayLogTimeOpen, setIsTrayLogTimeOpen] = useState(false);

  // Тот же фильтр по add_issues, что и кнопка "Добавить задачу" на IssuesPage
  // (см. docs/permissions.md) - хоткей "c" не должен подсовывать проект без прав.
  const creatableProjects = useMemo(
    () => projects.filter((p) => can("add_issues", p.id)),
    [projects, can],
  );
  // Тот же фильтр по log_time, что и "Залогировать время" на TimeTrackingPage -
  // пункт меню трея не должен подсовывать проект без прав.
  const loggableProjects = useMemo(
    () => projects.filter((p) => can("log_time", p.id)),
    [projects, can],
  );

  // Пункт "Залогировать время" в меню трея (issue #5) - открывает диалог
  // без разворачивания окна вручную, см. src-tauri/src/tray.rs.
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    void listen(TRAY_LOG_TIME_EVENT, () => setIsTrayLogTimeOpen(true)).then(
      (fn) => {
        unlisten = fn;
      },
    );
    return () => unlisten?.();
  }, []);

  // Badge-точка и tooltip на иконке трея - синхронизируются с тем же
  // unreadCount, что уже показывает NotificationsBell в Topbar (issue #5).
  useEffect(() => {
    void syncTrayBadge(unreadCount);
  }, [unreadCount]);

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
        notifications={{
          notifications,
          unreadCount,
          onMarkRead: markRead,
          onMarkAllRead: markAllRead,
          onOpenSettings: () => setIsNotificationSettingsOpen(true),
        }}
      >
        {/* key на путь - при переходе на другую страницу пойманная ошибка
            не "залипает" на исправно работающем разделе. */}
        <ErrorBoundary
          key={location.pathname}
          title="Не удалось отобразить раздел"
        >
          <Outlet
            context={
              { selectedProjectId, setSelectedProjectId } satisfies LayoutContext
            }
          />
        </ErrorBoundary>
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
      {/* Глобальный диалог логирования времени для пункта "Залогировать
          время" в меню трея (issue #5) - без trigger, только open/onOpenChange. */}
      <LogTimeDialog
        client={client}
        projects={loggableProjects}
        activities={activities}
        defaultProjectId={selectedProjectId}
        open={isTrayLogTimeOpen}
        onOpenChange={setIsTrayLogTimeOpen}
        onSubmit={async (input) => {
          if (!client) return;
          await createTimeEntry(client, input);
        }}
      />
      <HotkeysHelpDialog
        open={isHotkeysHelpOpen}
        onOpenChange={setIsHotkeysHelpOpen}
      />
      <NotificationSettingsDialog
        open={isNotificationSettingsOpen}
        onOpenChange={setIsNotificationSettingsOpen}
        settings={notificationSettings}
        onChange={setNotificationSettings}
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
