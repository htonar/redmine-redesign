import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearIntegrationTokens,
  loadIntegrationTokens,
  saveIntegrationTokens,
  type IntegrationTokens,
} from "@/lib/integration-tokens-storage";

/**
 * Токены GitHub/GitLab для живого статуса PR/MR-чипов - см. issue #22,
 * шаг 2. Только client-side (localStorage), сервер их не видит и не хранит -
 * тот же принцип, что и у Redmine API-ключа (см. src/pages/LoginPage.tsx).
 * Один токен на платформу, не на хост - осознанное ограничение из грилинга:
 * self-hosted GitHub Enterprise и github.com одновременно делить один токен
 * не смогут.
 */
export function IntegrationsPage() {
  const [tokens, setTokens] = useState<IntegrationTokens>(() => loadIntegrationTokens());
  const [isEditing, setIsEditing] = useState(false);
  const [values, setValues] = useState<IntegrationTokens>(tokens);

  function startEditing() {
    setValues(tokens);
    setIsEditing(true);
  }

  function cancelEditing() {
    setValues(tokens);
    setIsEditing(false);
  }

  function handleSave() {
    const next: IntegrationTokens = {};
    if (values.github?.trim()) next.github = values.github.trim();
    if (values.gitlab?.trim()) next.gitlab = values.gitlab.trim();

    if (Object.keys(next).length === 0) {
      clearIntegrationTokens();
    } else {
      saveIntegrationTokens(next);
    }
    setTokens(next);
    setIsEditing(false);
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle>Интеграции</CardTitle>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              Редактировать
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Личные токены доступа GitHub и GitLab - чтобы ссылки на pull request и
            merge request в задачах показывали живой статус (открыт / смерджен /
            закрыт / черновик), а не просто ссылку. Хранятся только в этом
            браузере, на сервер не отправляются и не сохраняются - используются
            только для прямых запросов к GitHub/GitLab.
          </p>

          {isEditing ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="integrations-github">GitHub personal access token</Label>
                <Input
                  id="integrations-github"
                  type="password"
                  autoComplete="new-password"
                  placeholder="ghp_..."
                  value={values.github ?? ""}
                  onChange={(e) => setValues({ ...values, github: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Действует и для self-hosted GitHub Enterprise - используется для
                  всех GitHub-хостов.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="integrations-gitlab">GitLab personal access token</Label>
                <Input
                  id="integrations-gitlab"
                  type="password"
                  autoComplete="new-password"
                  placeholder="glpat-..."
                  value={values.gitlab ?? ""}
                  onChange={(e) => setValues({ ...values, gitlab: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Действует и для self-hosted GitLab - используется для всех
                  GitLab-хостов.
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave}>Сохранить</Button>
                <Button variant="outline" onClick={cancelEditing}>
                  Отмена
                </Button>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">GitHub</div>
                <div className="text-sm">{tokens.github ? "Токен задан" : "Не задан"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">GitLab</div>
                <div className="text-sm">{tokens.gitlab ? "Токен задан" : "Не задан"}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
