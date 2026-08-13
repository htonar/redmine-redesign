import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useAccount } from "@/hooks/useAccount";
import { updateMyAccount } from "@/api/account";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface FieldProps {
  label: string;
  children: ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

interface EditValues {
  firstname: string;
  lastname: string;
  mail: string;
}

/**
 * Профиль пользователя - GET/PUT /my/account.json (src/api/account.ts).
 * Только имя/фамилия/email редактируемые - пароль, язык, уведомления не в
 * фокусе (см. CLAUDE.md, "Приоритеты дальше" про Профиль/Отчёты). После
 * успешного сохранения дергаем refreshUser() из AuthContext, чтобы имя в
 * Topbar обновилось сразу, не только после перезахода.
 */
export function ProfilePage() {
  const { client, refreshUser } = useAuth();
  const { account, isLoading, error, reload } = useAccount(client);

  const [isEditing, setIsEditing] = useState(false);
  const [values, setValues] = useState<EditValues | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (account && !isEditing) {
      setValues({ firstname: account.firstname, lastname: account.lastname, mail: account.mail });
    }
  }, [account, isEditing]);

  function startEditing() {
    if (!account) return;
    setValues({ firstname: account.firstname, lastname: account.lastname, mail: account.mail });
    setSaveError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    if (account) {
      setValues({ firstname: account.firstname, lastname: account.lastname, mail: account.mail });
    }
    setSaveError(null);
    setIsEditing(false);
  }

  async function handleSave() {
    if (!client || !account || !values) return;

    const patch: { firstname?: string; lastname?: string; mail?: string } = {};
    if (values.firstname !== account.firstname) patch.firstname = values.firstname;
    if (values.lastname !== account.lastname) patch.lastname = values.lastname;
    if (values.mail !== account.mail) patch.mail = values.mail;

    if (Object.keys(patch).length === 0) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await updateMyAccount(client, patch);
      reload();
      await refreshUser();
      setIsEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Не удалось сохранить профиль.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Загрузка...
      </div>
    );
  }

  if (error || !account) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error ?? "Не удалось загрузить профиль."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle>Профиль</CardTitle>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              Редактировать
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          {isEditing && values ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="profile-firstname">Имя</Label>
                  <Input
                    id="profile-firstname"
                    value={values.firstname}
                    onChange={(e) => setValues({ ...values, firstname: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="profile-lastname">Фамилия</Label>
                  <Input
                    id="profile-lastname"
                    value={values.lastname}
                    onChange={(e) => setValues({ ...values, lastname: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-mail">Email</Label>
                <Input
                  id="profile-mail"
                  type="email"
                  value={values.mail}
                  onChange={(e) => setValues({ ...values, mail: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => void handleSave()}
                  disabled={isSaving || !values.firstname.trim() || !values.lastname.trim() || !values.mail.trim()}
                >
                  {isSaving ? "Сохраняем..." : "Сохранить"}
                </Button>
                <Button variant="outline" onClick={cancelEditing} disabled={isSaving}>
                  Отмена
                </Button>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Логин">
                <span className="flex items-center gap-2">
                  {account.login}
                  {account.admin && <Badge variant="secondary">Администратор</Badge>}
                </span>
              </Field>
              <Field label="Email">{account.mail}</Field>
              <Field label="Имя">{account.firstname}</Field>
              <Field label="Фамилия">{account.lastname}</Field>
              <Field label="Регистрация">{formatDateTime(account.createdOn)}</Field>
              <Field label="Последний вход">
                {account.lastLoginOn ? formatDateTime(account.lastLoginOn) : "—"}
              </Field>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
