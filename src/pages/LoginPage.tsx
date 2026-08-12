import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/LoginForm";

/** Экран логина - см. docs/design.md про hero/бренд-акцент. */
export function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand text-lg font-bold text-brand-foreground">
            R
          </span>
          <span className="text-xl font-semibold text-foreground">Redmine</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Вход</CardTitle>
            <CardDescription>
              Подключитесь к своему Redmine-инстансу по API-ключу
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
