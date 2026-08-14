import { Bell, Settings } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppNotification } from "@/lib/notifications";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface NotificationsBellProps {
  notifications: AppNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onOpenSettings: () => void;
}

/**
 * In-app индикатор уведомлений (issue #3) - бейдж непрочитанных + список в
 * дропдауне рядом с остальными иконками Topbar. Данные и OS push - см.
 * useNotifications.ts. Одинаково доступен в веб- и десктоп-сборке.
 */
export function NotificationsBell({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onOpenSettings,
}: NotificationsBellProps) {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Уведомления" className="relative">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium leading-none text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          Уведомления
          <span className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="text-xs font-normal text-muted-foreground hover:text-foreground hover:underline"
              >
                Прочитать всё
              </button>
            )}
            <button
              type="button"
              aria-label="Настройки уведомлений"
              onClick={onOpenSettings}
              className="text-muted-foreground hover:text-foreground"
            >
              <Settings className="size-3.5" />
            </button>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            Нет уведомлений
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="flex flex-col items-start gap-0.5 whitespace-normal py-2"
                onSelect={() => {
                  onMarkRead(notification.id);
                  navigate(`/issues/${notification.issueId}`);
                }}
              >
                <div className="flex w-full items-start gap-2">
                  {!notification.read && (
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                  <span
                    className={
                      notification.read
                        ? "text-sm text-muted-foreground"
                        : "text-sm font-medium"
                    }
                  >
                    {notification.message}
                  </span>
                </div>
                <span className="pl-3.5 text-xs text-muted-foreground">
                  {formatTime(notification.createdAt)}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
