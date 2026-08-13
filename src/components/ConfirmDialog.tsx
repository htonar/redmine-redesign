import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** Пока true - кнопка подтверждения дизейблена и крутится спиннер. */
  isConfirming?: boolean;
  /** Красная кнопка подтверждения - для необратимых действий вроде удаления. */
  destructive?: boolean;
}

/**
 * Модалка подтверждения вместо `window.confirm` - блокирующий нативный
 * диалог плохо смотрится в UI (не следует теме, дизайну) и вдобавок
 * зависает при браузерной автоматизации (CDP не может кликнуть/сделать
 * скриншот, пока открыт нативный alert/confirm). Общий компонент - чтобы не
 * плодить одну и ту же разметку в каждом месте с удалением (задача, запись
 * времени).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Удалить",
  cancelLabel = "Отмена",
  onConfirm,
  isConfirming = false,
  destructive = true,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isConfirming}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={isConfirming}
            onClick={onConfirm}
          >
            {isConfirming && <Loader2 className="size-3.5 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
