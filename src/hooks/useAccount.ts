import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";
import { getMyAccount, type Account } from "@/api/account";

/** Загружает собственный профиль (страница "Профиль"). reload() - после правки. */
export function useAccount(client: RedmineClient | null) {
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!client) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getMyAccount(client)
      .then((data) => {
        if (cancelled) return;
        setAccount(data);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Не удалось загрузить профиль.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, reloadToken]);

  function reload() {
    setReloadToken((t) => t + 1);
  }

  return { account, isLoading, error, reload };
}
