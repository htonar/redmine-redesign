/**
 * Настройки генерации имени ветки (issue #27) - шаблон, карта трекер->префикс,
 * флаг использования AI для англоязычного slug. Глобально в localStorage (как
 * ai-settings-storage.ts), не на сервере.
 */

import {
  DEFAULT_BRANCH_NAME_CONFIG,
  DEFAULT_TYPE_MAP,
  type BranchNameConfig,
} from "@/lib/branch-name";

const STORAGE_KEY = "redmine-client:branch-name-config";

export function loadBranchNameConfig(): BranchNameConfig {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_BRANCH_NAME_CONFIG, typeMap: { ...DEFAULT_TYPE_MAP } };
  try {
    const parsed = JSON.parse(raw) as Partial<BranchNameConfig>;
    return {
      template:
        typeof parsed.template === "string" && parsed.template.trim()
          ? parsed.template
          : DEFAULT_BRANCH_NAME_CONFIG.template,
      typeMap:
        parsed.typeMap && typeof parsed.typeMap === "object"
          ? (parsed.typeMap as Record<string, string>)
          : { ...DEFAULT_TYPE_MAP },
      useAi: Boolean(parsed.useAi),
    };
  } catch {
    return { ...DEFAULT_BRANCH_NAME_CONFIG, typeMap: { ...DEFAULT_TYPE_MAP } };
  }
}

export function saveBranchNameConfig(config: BranchNameConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function resetBranchNameConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Парсит текст вида `bug=fix` (по строке на пару) в карту трекер->префикс. */
export function parseTypeMap(text: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim().toLowerCase();
    const value = trimmed.slice(eq + 1).trim();
    if (key && value) map[key] = value;
  }
  return map;
}

/** Обратно: карта -> текст `bug=fix` для textarea в настройках. */
export function formatTypeMap(map: Record<string, string>): string {
  return Object.entries(map)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}
