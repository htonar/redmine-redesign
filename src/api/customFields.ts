import type { RedmineClient } from "@/api/client";
import type { components } from "@/api/schema";

export type CustomFieldDefinition = components["schemas"]["custom_field"];

/**
 * Определения пользовательских полей (тип, возможные значения, к каким
 * трекерам применимо) - `GET /custom_fields.json` в реальном Redmine
 * доступен только администраторам (не задокументировано явно в REST-вики,
 * подтверждено практикой - обычные пользователи получают 403). Поэтому
 * best-effort: любая неудача (403 и любая другая) молча возвращает `[]`, а
 * не бросает ошибку - у обычных пользователей форма создания задачи просто
 * не покажет кастомные поля (см. CLAUDE.md, "Custom fields"), но карточка
 * уже существующей задачи все равно отображает их значения напрямую из
 * самого issue (тот эндпоинт этого списка не требует).
 */
export async function getCustomFieldDefinitions(
  client: RedmineClient,
): Promise<CustomFieldDefinition[]> {
  try {
    const { data, error } = await client.GET("/custom_fields.{format}", {
      params: { path: { format: "json" } },
    });
    if (error || !data) return [];
    return data.custom_fields;
  } catch {
    return [];
  }
}
