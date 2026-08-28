import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NotificationSettingsForm } from "@/components/layout/NotificationSettingsForm";
import type { NotificationSettings } from "@/lib/notifications";

export interface NotificationSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: NotificationSettings;
  onChange: (settings: NotificationSettings) => void;
}

/**
 * Быстрый доступ к настройкам уведомлений из колокольчика в шапке. Те же
 * контролы есть и карточкой в разделе «Настройки» (issue #45) - общее тело
 * в NotificationSettingsForm.
 */
export function NotificationSettingsDialog({
  open,
  onOpenChange,
  settings,
  onChange,
}: NotificationSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Настройки уведомлений</DialogTitle>
          <DialogDescription>
            Redmine не поддерживает push - опрос идет по расписанию, пока
            вкладка открыта.
          </DialogDescription>
        </DialogHeader>

        <NotificationSettingsForm settings={settings} onChange={onChange} />
      </DialogContent>
    </Dialog>
  );
}
