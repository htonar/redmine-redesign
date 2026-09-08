import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  resolveStatusToneOverrides,
  setStatusColorChoice,
  type StatusColorChoice,
  type StatusColorMap,
  type StatusToneOverrides,
} from "@/lib/status-colors";
import {
  loadStatusColors,
  saveStatusColors,
} from "@/lib/status-colors-storage";

interface StatusColorsValue {
  /** Сырые выборы пользователя (для экрана настроек). */
  map: StatusColorMap;
  /** Только явные тоны по нормализованному имени - для statusTone/statusBadgeClass. */
  overrides: StatusToneOverrides;
  setChoice: (name: string, choice: StatusColorChoice) => void;
  reset: () => void;
}

const StatusColorsContext = createContext<StatusColorsValue | null>(null);

/**
 * Ручная настройка тонов статусов (issue #65). Провайдер поднят в AppLayout,
 * чтобы список задач, канбан, дашборд, карточка задачи и бары отчётов брали
 * одну и ту же карту без прокидывания пропсами. Персист - localStorage по
 * baseUrl+user (см. status-colors-storage.ts).
 */
export function StatusColorsProvider({ children }: { children: ReactNode }) {
  const { baseUrl, user } = useAuth();
  const [map, setMap] = useState<StatusColorMap>(() =>
    loadStatusColors(baseUrl, user?.id),
  );

  useEffect(() => {
    setMap(loadStatusColors(baseUrl, user?.id));
  }, [baseUrl, user?.id]);

  const setChoice = useCallback(
    (name: string, choice: StatusColorChoice) => {
      setMap((prev) => {
        const next = setStatusColorChoice(prev, name, choice);
        saveStatusColors(baseUrl, user?.id, next);
        return next;
      });
    },
    [baseUrl, user?.id],
  );

  const reset = useCallback(() => {
    setMap({});
    saveStatusColors(baseUrl, user?.id, {});
  }, [baseUrl, user?.id]);

  const value = useMemo<StatusColorsValue>(
    () => ({
      map,
      overrides: resolveStatusToneOverrides(map),
      setChoice,
      reset,
    }),
    [map, setChoice, reset],
  );

  return (
    <StatusColorsContext.Provider value={value}>
      {children}
    </StatusColorsContext.Provider>
  );
}

/** Полный контекст - для экрана настроек (нужны сырые выборы и сеттер). */
export function useStatusColors(): StatusColorsValue {
  const ctx = useContext(StatusColorsContext);
  if (!ctx) {
    throw new Error("useStatusColors вне StatusColorsProvider");
  }
  return ctx;
}

/**
 * Только карта тонов для рендера - безопасна вне провайдера (вернёт пустую
 * карту, т.е. обычную эвристику), чтобы компоненты статуса не падали в
 * тестах и в изолированном рендере.
 */
export function useStatusToneOverrides(): StatusToneOverrides {
  return useContext(StatusColorsContext)?.overrides ?? EMPTY;
}

const EMPTY: StatusToneOverrides = {};
