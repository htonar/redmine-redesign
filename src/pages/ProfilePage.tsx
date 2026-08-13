import { useEffect, useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useMyAccount } from "@/hooks/useMyAccount";
import { updateMyAccount, type MyAccount } from "@/api/account";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface FormValues {
  firstname: string;
  lastname: string;
  mail: string;
}

function toFormValues(account: MyAccount): FormValues {
  return { firstname: account.firstname, lastname: account.lastname, mail: account.mail };
}

/**
 * Профиль текущего пользователя. Редактируем только то, что реально приходит
 * обратно в GET /my/account.json - имя/фамилию/email. Язык, часовой пояс,
 * настройки уведомлений (mail_notification, pref) принимает PUT, но GET их
 * не отдает вообще (это отдельная от User модель настроек, в JSON не
 * подмешивается) - показывать для них форму с заведомо неверными дефолтами
 * (например "включено", когда на самом деле выключено) хуже, чем не
 * показывать вовсе, поэтому раздела настроек уведомлений здесь нет.
 */
export function ProfilePage() {
  const { client } = useAuth();
  const { account, isLoading, error, reload } = useMyAccount(client);

  const [values, setValues] = useState<FormValues | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const firstnameId = useId();
  const lastnameId = useId();
  const mailId = useId();

  useEffect(() => {
    if (account) setValues(toFormValues(account));
  }, [account]);

  async function handleSave() {
    if (!client || !account || !values) return;
    setSaveError(null);
    setSaved(false);

    if (!values.firstname.trim() || !values.lastname.trim()) {
      setSaveError("Имя и фамилия обязательны.");
      return;
    }

    const patch: Partial<FormValues> = {};
    if (values.firstname !== account.firstname) patch.firstname = values.firstname;
    if (values.lastname !== account.lastname) patch.lastname = values.lastname;
    if (values.mail !== account.mail) patch.mail = values.mail;

    if (Object.keys(patch).length === 0) return;

    setIsSaving(true);
    try {
      await updateMyAccount(client, patch);
      reload();
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Не удалось сохранить профиль.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">Профиль</h1>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Загрузка...
        </div>
      )}

      {!isLoading && account && values && (
        <>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Учетная запись</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>
                  Логин: <span className="text-foreground">{account.login}</span>
                </span>
                {account.admin && <Badge variant="outline">Администратор</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                <span>Зарегистрирован: {formatDateTime(account.created_on)}</span>
                <span>Последний вход: {formatDateTime(account.last_login_on)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Личные данные</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={firstnameId} className="mb-1.5">
                    Имя
                  </Label>
                  <Input
                    id={firstnameId}
                    value={values.firstname}
                    onChange={(e) => setValues({ ...values, firstname: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor={lastnameId} className="mb-1.5">
                    Фамилия
                  </Label>
                  <Input
                    id={lastnameId}
                    value={values.lastname}
                    onChange={(e) => setValues({ ...values, lastname: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor={mailId} className="mb-1.5">
                  Email
                </Label>
                <Input
                  id={mailId}
                  type="email"
                  value={values.mail}
                  onChange={(e) => setValues({ ...values, mail: e.target.value })}
                />
              </div>

              {saveError && (
                <Alert variant="destructive">
                  <AlertDescription>{saveError}</AlertDescription>
                </Alert>
              )}
              {saved && !saveError && (
                <Alert>
                  <AlertDescription>Сохранено.</AlertDescription>
                </Alert>
              )}

              <Button size="sm" className="w-fit" onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="size-3.5 animate-spin" />}
                Сохранить
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
