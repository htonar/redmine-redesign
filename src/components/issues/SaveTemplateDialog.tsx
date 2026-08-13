import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface SaveTemplateDialogProps {
  onSave: (name: string) => void;
  trigger: React.ReactNode;
}

/** Диалог сохранения текущих полей формы задачи как именованного шаблона - см. useIssueTemplates, по образцу SaveViewDialog. */
export function SaveTemplateDialog({
  onSave,
  trigger,
}: SaveTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const fieldId = useId();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Сохранить шаблон</DialogTitle>
            <DialogDescription>
              Трекер, приоритет, категория и описание сохранятся под этим именем
              - откроются одним кликом при создании следующей задачи.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor={fieldId} className="mb-1.5">
              Название
            </Label>
            <Input
              id={fieldId}
              autoFocus
              placeholder="Например, «Баг - фронтенд»"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!name.trim()}>
              Сохранить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
