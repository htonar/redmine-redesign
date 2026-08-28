import { isTauri } from "@tauri-apps/api/core";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  NOTIFICATION_TRIGGER_LABELS,
  type NotificationSettings,
  type NotificationTrigger,
} from "@/lib/notifications";

const TRIGGER_ORDER: NotificationTrigger[] = [
  "assigned",
  "status_changed",
  "activity",
  "due_soon",
];

const INTERVAL_OPTIONS_MINUTES = [5, 7, 10, 15, 30];

export interface NotificationSettingsFormProps {
  settings: NotificationSettings;
  onChange: (settings: NotificationSettings) => void;
}

/**
 * Тело настроек уведомлений (issue #4) - переиспользуется в диалоге из
 * колокольчика (NotificationSettingsDialog) и как карточка в разделе
 * «Настройки» (issue #45). Своего состояния нет - только settings/onChange,
 * персист на уровне AppLayout (usePersistedState, ключ "notification-settings").
 */
export function NotificationSettingsForm({
  settings,
  onChange,
}: NotificationSettingsFormProps) {
  const setTrigger = (trigger: NotificationTrigger, value: boolean) =>
    onChange({
      ...settings,
      triggers: { ...settings.triggers, [trigger]: value },
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Label
          htmlFor="notifications-enabled"
          className="flex flex-col items-start gap-0.5"
        >
          Уведомления
          <span className="text-xs font-normal text-muted-foreground">
            Полностью выключает опрос Redmine
          </span>
        </Label>
        <Switch
          id="notifications-enabled"
          checked={settings.enabled}
          onCheckedChange={(checked) =>
            onChange({ ...settings, enabled: checked })
          }
        />
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        {TRIGGER_ORDER.map((trigger) => (
          <div
            key={trigger}
            className="flex items-center justify-between gap-4"
          >
            <Label
              htmlFor={`notifications-trigger-${trigger}`}
              className="font-normal"
            >
              {NOTIFICATION_TRIGGER_LABELS[trigger]}
            </Label>
            <Switch
              id={`notifications-trigger-${trigger}`}
              size="sm"
              disabled={!settings.enabled}
              checked={settings.triggers[trigger]}
              onCheckedChange={(checked) => setTrigger(trigger, checked)}
            />
          </div>
        ))}
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="notifications-interval" className="font-normal">
          Интервал опроса
        </Label>
        <Select
          value={String(settings.intervalMinutes)}
          disabled={!settings.enabled}
          onValueChange={(v) =>
            onChange({ ...settings, intervalMinutes: Number(v) })
          }
        >
          <SelectTrigger id="notifications-interval" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTERVAL_OPTIONS_MINUTES.map((minutes) => (
              <SelectItem key={minutes} value={String(minutes)}>
                {minutes} мин
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isTauri() && (
        <>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <Label
              htmlFor="notifications-os-push"
              className="flex flex-col items-start gap-0.5"
            >
              Системные уведомления
              <span className="text-xs font-normal text-muted-foreground">
                Отдельно от бейджа в шапке
              </span>
            </Label>
            <Switch
              id="notifications-os-push"
              disabled={!settings.enabled}
              checked={settings.osPushEnabled}
              onCheckedChange={(checked) =>
                onChange({ ...settings, osPushEnabled: checked })
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
