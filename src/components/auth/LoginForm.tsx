import { useId, useState, type FormEvent } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Форма входа - только по API-ключу, см. CLAUDE.md раздел "Важное ограничение:
 * авторизация и 2FA". Логин/пароль сюда сознательно не добавляем: для аккаунтов
 * с 2FA (в т.ч. у автора проекта) Redmine отклоняет Basic-авторизацию по паролю.
 */
export function LoginForm() {
  const { login, status, error } = useAuth();
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const urlFieldId = useId();
  const keyFieldId = useId();

  const isSubmitting = status === "authenticating";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!baseUrl.trim() || !apiKey.trim()) return;
    void login(baseUrl, apiKey);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={urlFieldId}>Адрес Redmine</Label>
        <Input
          id={urlFieldId}
          type="url"
          placeholder="https://redmine.example.com"
          autoComplete="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={keyFieldId}>API-ключ</Label>
        <Input
          id={keyFieldId}
          type="password"
          placeholder="Найти в Redmine: Моя учетная запись → API access key"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          Вход только по API-ключу - работает для аккаунтов с двухфакторной
          аутентификацией, в отличие от логина и пароля.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isSubmitting} className="mt-1">
        {isSubmitting ? "Проверяем..." : "Войти"}
      </Button>
    </form>
  );
}
