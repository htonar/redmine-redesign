import { useEffect, useState } from "react";
import { loadIntegrationTokens } from "@/lib/integration-tokens-storage";
import { getPrMrStatus, type PrMrStatus } from "@/lib/pr-mr-status";
import type { PrMrLink } from "@/lib/pr-mr-links";

// Тот же env var, что и у createRedmineClient (src/contexts/AuthContext.tsx) -
// нужен только для GitLab-запросов в веб-сборке (см. src/lib/pr-mr-status.ts).
const PROXY_URL = import.meta.env.VITE_REDMINE_PROXY_URL;

/**
 * Живой статус для набора PR/MR-ссылок в тексте задачи - issue #22, шаг 2.
 * Токены читаются из localStorage при каждом маунте, не подписка - смена
 * токенов на странице "Настройки" подхватится при следующем рендере с этими
 * ссылками, отдельного реактивного стора не заводим (см. грилинг: кэш на
 * сессию, без авто-обновления). Сам статус на уровне ссылки кэшируется в
 * src/lib/pr-mr-status.ts - при повторном рендере с тем же набором ссылок
 * сеть не бьется снова (см. ключ эффекта - `key` из url ссылок).
 */
export function usePrMrStatuses(links: PrMrLink[]): Record<string, PrMrStatus | undefined> {
  const key = links.map((link) => link.url).join(",");
  const [statuses, setStatuses] = useState<Record<string, PrMrStatus | undefined>>({});

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const tokens = loadIntegrationTokens();

    for (const link of links) {
      getPrMrStatus(link, { tokens, proxyUrl: PROXY_URL }).then((status) => {
        if (cancelled) return;
        setStatuses((prev) =>
          prev[link.url] === status ? prev : { ...prev, [link.url]: status },
        );
      });
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return statuses;
}
