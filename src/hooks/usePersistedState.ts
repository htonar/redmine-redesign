import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  loadPersistedState,
  savePersistedState,
  type PersistedStateKey,
} from "@/lib/persisted-state-storage";

/**
 * useState, персистящий значение в localStorage между перезапусками (issue
 * #6) - обертка над persisted-state-storage.ts, по образцу useIssueViews.ts.
 * AppLayout монтируется только после того, как AuthContext уже восстановил
 * сессию (см. App.tsx, status "restoring"), так что baseUrl/userId доступны
 * уже на первом рендере - гонки с асинхронным восстановлением сессии нет.
 * Без baseUrl/userId (аноним) - обычный useState без персиста.
 */
export function usePersistedState<T>(
  baseUrl: string | null,
  userId: number | undefined,
  key: PersistedStateKey,
  fallback: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() =>
    baseUrl && userId ? loadPersistedState(baseUrl, userId, key, fallback) : fallback,
  );

  useEffect(() => {
    if (baseUrl && userId) {
      savePersistedState(baseUrl, userId, key, state);
    }
  }, [baseUrl, userId, key, state]);

  return [state, setState];
}
