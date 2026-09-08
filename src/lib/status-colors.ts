import type { StatusToneOverrides, Tone } from "@/lib/issue-visuals";

export type { StatusToneOverrides };

/**
 * Ручная настройка тона статуса (issue #65). Тон открытого статуса иначе -
 * эвристика по названию (statusTone в issue-visuals.ts): "отклонён" ->
 * красный, "в работе" -> янтарный и т.п., а неизвестное имя ("Заморожен",
 * "На согласовании у юристов") получает нейтральный тон. Здесь пользователь
 * задаёт тон конкретным статусам вручную; персист - localStorage по
 * baseUrl+user, как остальные prefs.
 *
 * Ключ карты - нормализованное имя статуса (не id): эвристика тоже по имени,
 * а список статусов в Redmine глобальный и правится редко. Переименование
 * статуса сбрасывает его оверрайд - приемлемо.
 */

/** "auto" - оставить эвристику по названию (значение по умолчанию). */
export type StatusColorChoice = Tone | "auto";

/** normalized name -> выбор пользователя. "auto"/отсутствие ключа = эвристика. */
export type StatusColorMap = Record<string, StatusColorChoice>;

export const STATUS_TONE_CHOICES: {
  value: StatusColorChoice;
  label: string;
}[] = [
  { value: "auto", label: "Авто (по названию)" },
  { value: "neutral", label: "Нейтральный" },
  { value: "muted", label: "Серый" },
  { value: "info", label: "Синий" },
  { value: "progress", label: "Янтарный" },
  { value: "success", label: "Зелёный" },
  { value: "warning", label: "Оранжевый" },
  { value: "danger", label: "Красный" },
];

const VALID_CHOICES = new Set<string>(STATUS_TONE_CHOICES.map((c) => c.value));

export function normalizeStatusName(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

export function isStatusColorChoice(value: unknown): value is StatusColorChoice {
  return typeof value === "string" && VALID_CHOICES.has(value);
}

/** Отбрасывает мусор и "auto", приводит ключи к нормализованному виду. */
export function resolveStatusToneOverrides(
  map: StatusColorMap | null | undefined,
): StatusToneOverrides {
  const out: StatusToneOverrides = {};
  if (!map) return out;
  for (const [name, choice] of Object.entries(map)) {
    if (choice === "auto" || !isStatusColorChoice(choice)) continue;
    const key = normalizeStatusName(name);
    if (key) out[key] = choice;
  }
  return out;
}

/**
 * Новое значение карты после выбора пользователя. "auto" убирает ключ,
 * чтобы в сторадже не копился мусор.
 */
export function setStatusColorChoice(
  map: StatusColorMap,
  name: string,
  choice: StatusColorChoice,
): StatusColorMap {
  const key = normalizeStatusName(name);
  const next = { ...map };
  if (!key || choice === "auto") {
    delete next[key];
  } else {
    next[key] = choice;
  }
  return next;
}
