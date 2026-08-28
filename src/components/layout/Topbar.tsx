import { Keyboard, Menu, Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { ProjectSwitcher } from "@/components/layout/ProjectSwitcher";
import { NotificationsBell, type NotificationsBellProps } from "@/components/layout/NotificationsBell";
import type { Project } from "@/hooks/useProjects";
import { getGravatarUrl } from "@/lib/gravatar";
import type { RedmineClient } from "@/api/client";
import { useAppUpdater } from "@/hooks/useAppUpdater";

export interface CurrentUser {
  name: string;
  initials: string;
  email: string;
}

export interface TopbarProps {
  client: RedmineClient | null;
  projects: Project[];
  projectsLoading: boolean;
  /** null - фильтр "Все проекты". */
  selectedProjectId: number | null;
  onProjectChange: (projectId: number | null) => void;
  user: CurrentUser;
  onLogout: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onShowHotkeysHelp?: () => void;
  notifications: NotificationsBellProps;
  /** Открыть выезжающий сайдбар на узких экранах (< lg). */
  onOpenNav?: () => void;
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
  onShowHotkeysHelp,
  notifications,
  onOpenNav,
}: TopbarProps) {
  const navigate = useNavigate();
  const updater = useAppUpdater();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:gap-4 sm:px-4">
      {onOpenNav && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 lg:hidden"
          aria-label="Меню"
          onClick={onOpenNav}
        >
          <Menu className="size-5" />
        </Button>
      )}

      <div className="min-w-0 flex-1 sm:max-w-sm">
        <GlobalSearch client={client} />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <ProjectSwitcher
          projects={projects}
          loading={projectsLoading}
          selectedProjectId={selectedProjectId}
          onChange={onProjectChange}
        />

        <NotificationsBell {...notifications} />

        {onShowHotkeysHelp && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Горячие клавиши"
            className="hidden sm:inline-flex"
            onClick={onShowHotkeysHelp}
          >
            <Keyboard className="size-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          aria-label={
            theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"
          }
          onClick={onToggleTheme}
        >
          {theme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-accent"
            >
              <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">
                {user.name}
              </span>
              <Avatar className="size-8">
                <AvatarImage
                  src={getGravatarUrl(user.email, 64)}
                  alt={user.name}
                />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user.initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => navigate("/profile")}>
              Профиль
            </DropdownMenuItem>
            {updater.supported && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={updater.status === "checking"}
                  onSelect={updater.checkForUpdate}
                >
                  {updater.status === "checking"
                    ? "Проверка обновлений..."
                    : updater.status === "none"
                      ? "Обновлений нет"
                      : "Проверить обновления"}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem variant="destructive" onSelect={onLogout}>
              Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
