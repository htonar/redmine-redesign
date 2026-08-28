import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_BRANCH_TEMPLATE,
  type BranchNameConfig,
} from "@/lib/branch-name";
import {
  formatTypeMap,
  loadBranchNameConfig,
  parseTypeMap,
  saveBranchNameConfig,
} from "@/lib/branch-name-storage";
import {
  clearIntegrationTokens,
  loadIntegrationTokens,
  saveIntegrationTokens,
  type IntegrationTokens,
} from "@/lib/integration-tokens-storage";
import {
  clearAiSettings,
  loadAiSettings,
  saveAiSettings,
  type AiSettingsStored,
} from "@/lib/ai-settings-storage";

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

  const [aiSettings, setAiSettings] = useState<AiSettingsStored>(() => loadAiSettings());
  const [isEditingAi, setIsEditingAi] = useState(false);
  const [aiValues, setAiValues] = useState<AiSettingsStored>(aiSettings);
  const isAiConfigured = Boolean(aiSettings.baseUrl && aiSettings.apiKey && aiSettings.model);
  const canSaveAi = Boolean(
    aiValues.baseUrl?.trim() && aiValues.apiKey?.trim() && aiValues.model?.trim(),
  );

  function startEditingAi() {
    setAiValues(aiSettings);
    setIsEditingAi(true);
  }

  function cancelEditingAi() {
    setAiValues(aiSettings);
    setIsEditingAi(false);
  }

  function handleSaveAi() {
    if (!canSaveAi) return;
    const next: AiSettingsStored = {
      baseUrl: aiValues.baseUrl!.trim(),
      apiKey: aiValues.apiKey!.trim(),
      model: aiValues.model!.trim(),
    };
    saveAiSettings(next);
    setAiSettings(next);
    setIsEditingAi(false);
  }

  function handleClearAi() {
    clearAiSettings();
    setAiSettings({});
    setAiValues({});
    setIsEditingAi(false);
  }

  const [branchCfg, setBranchCfg] = useState<BranchNameConfig>(() =>
    loadBranchNameConfig(),
  );
  const [branchTemplate, setBranchTemplate] = useState(branchCfg.template);
  const [branchUseAi, setBranchUseAi] = useState(branchCfg.useAi);
  const [branchTypeMapText, setBranchTypeMapText] = useState(() =>
    formatTypeMap(branchCfg.typeMap),
  );
  const [branchSaved, setBranchSaved] = useState(false);

  function handleSaveBranch() {
    const next: BranchNameConfig = {
      template: branchTemplate.trim() || DEFAULT_BRANCH_TEMPLATE,
      typeMap: parseTypeMap(branchTypeMapText),
      useAi: branchUseAi,
    };
    saveBranchNameConfig(next);
    setBranchCfg(next);
    setBranchTemplate(next.template);
    setBranchTypeMapText(formatTypeMap(next.typeMap));
    setBranchSaved(true);
    setTimeout(() => setBranchSaved(false), 2000);
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle>AI-ассистент</CardTitle>
          {!isEditingAi && (
            <Button variant="outline" size="sm" onClick={startEditingAi}>
              Редактировать
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Свой ключ для любого OpenAI-совместимого AI-провайдера (OpenAI,
            OpenRouter, Groq и т.д.) - используется, например, для краткого
            пересказа обсуждения задачи. Текст задачи и комментариев уходит
            напрямую из браузера указанному провайдеру. Ключ хранится только в
            этом браузере, на сервер не отправляется и не сохраняется.
          </p>

          {isEditingAi ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="integrations-ai-base-url">Base URL</Label>
                <Input
                  id="integrations-ai-base-url"
                  placeholder="https://openrouter.ai/api/v1"
                  value={aiValues.baseUrl ?? ""}
                  onChange={(e) => setAiValues({ ...aiValues, baseUrl: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="integrations-ai-key">API-ключ</Label>
                <Input
                  id="integrations-ai-key"
                  type="password"
                  autoComplete="new-password"
                  placeholder="sk-..."
                  value={aiValues.apiKey ?? ""}
                  onChange={(e) => setAiValues({ ...aiValues, apiKey: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="integrations-ai-model">Модель</Label>
                <Input
                  id="integrations-ai-model"
                  placeholder="gpt-4o-mini"
                  value={aiValues.model ?? ""}
                  onChange={(e) => setAiValues({ ...aiValues, model: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveAi} disabled={!canSaveAi}>
                  Сохранить
                </Button>
                <Button variant="outline" onClick={cancelEditingAi}>
                  Отмена
                </Button>
                {isAiConfigured && (
                  <Button variant="ghost" onClick={handleClearAi}>
                    Удалить
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="text-sm">
              {isAiConfigured ? `Настроено: ${aiSettings.model}` : "Не настроено"}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Имя ветки</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Кнопка «Ветка» на карточке задачи собирает имя git-ветки по шаблону
            и кладёт его в буфер обмена. Плейсхолдеры:{" "}
            <code className="text-xs">{"{type}"}</code>,{" "}
            <code className="text-xs">{"{id}"}</code>,{" "}
            <code className="text-xs">{"{slug}"}</code>,{" "}
            <code className="text-xs">{"{tracker}"}</code>,{" "}
            <code className="text-xs">{"{project}"}</code>.
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branch-template">Шаблон</Label>
            <Input
              id="branch-template"
              value={branchTemplate}
              placeholder={DEFAULT_BRANCH_TEMPLATE}
              onChange={(e) => setBranchTemplate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branch-type-map">
              Префикс по трекеру (по строке{" "}
              <code className="text-xs">трекер=префикс</code>)
            </Label>
            <Textarea
              id="branch-type-map"
              rows={4}
              className="font-mono text-xs"
              value={branchTypeMapText}
              placeholder={"bug=fix\nбаг=fix"}
              onChange={(e) => setBranchTypeMapText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Трекер, которого нет в списке, даёт префикс{" "}
              <code className="text-xs">feature</code>.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="branch-use-ai">AI для англоязычного slug</Label>
              <p className="text-xs text-muted-foreground">
                {isAiConfigured
                  ? "Тема задачи уходит настроенному AI-провайдеру; при ошибке - транслитерация."
                  : "Сначала настройте AI-ассистента выше."}
              </p>
            </div>
            <Switch
              id="branch-use-ai"
              checked={branchUseAi && isAiConfigured}
              disabled={!isAiConfigured}
              onCheckedChange={setBranchUseAi}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleSaveBranch}>Сохранить</Button>
            {branchSaved && (
              <span className="text-sm text-emerald-600">Сохранено</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
