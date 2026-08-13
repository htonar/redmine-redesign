import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ProjectVersion } from "@/hooks/useProjectVersions";
import type { UploadFileInput } from "@/api/files";

const NO_VERSION = "none";

export interface UploadFileDialogProps {
  trigger: ReactNode;
  versions: ProjectVersion[];
  onSubmit: (input: Omit<UploadFileInput, "projectId">) => Promise<void>;
}

/** Диалог загрузки файла в текущий проект (Files-модуль) - см. FilesPage. */
export function UploadFileDialog({ trigger, versions, onSubmit }: UploadFileDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [versionId, setVersionId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fileFieldId = useId();
  const descriptionFieldId = useId();
  const versionFieldId = useId();

  function resetForm() {
    setFile(null);
    setDescription("");
    setVersionId(null);
    setFormError(null);
  }

  function handleOpenChange(next: boolean) {
    if (next) resetForm();
    setOpen(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!file) {
      setFormError("Выберите файл.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ file, description: description || undefined, versionId: versionId ?? undefined });
      setOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Не удалось загрузить файл.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Загрузить файл</DialogTitle>
            <DialogDescription>Файл появится в разделе "Файлы" этого проекта.</DialogDescription>
          </DialogHeader>

          <div>
            <Label htmlFor={fileFieldId} className="mb-1.5">
              Файл *
            </Label>
            <Input
              id={fileFieldId}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div>
            <Label htmlFor={descriptionFieldId} className="mb-1.5">
              Описание
            </Label>
            <Input
              id={descriptionFieldId}
              placeholder="Необязательно"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor={versionFieldId} className="mb-1.5">
              Версия
            </Label>
            <Select
              value={versionId !== null ? String(versionId) : NO_VERSION}
              onValueChange={(v) => setVersionId(v === NO_VERSION ? null : Number(v))}
            >
              <SelectTrigger id={versionFieldId} className="w-full">
                <SelectValue placeholder="Не выбрана" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_VERSION}>Без версии</SelectItem>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
              Загрузить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
