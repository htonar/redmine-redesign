import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";
import {
  getCustomFieldDefinitions,
  type CustomFieldDefinition,
} from "@/api/customFields";

/**
 * Справочник, не привязан к проекту/трекеру - грузится один раз. Для
 * не-администраторов список молча остаётся пустым (см. api/customFields.ts) -
 * это ожидаемо, не ошибка, isLoading просто отражает сам факт запроса.
 */
export function useCustomFieldDefinitions(client: RedmineClient | null) {
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client) {
      setDefinitions([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    getCustomFieldDefinitions(client)
      .then((defs) => {
        if (!cancelled) setDefinitions(defs);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  return { definitions, isLoading };
}
