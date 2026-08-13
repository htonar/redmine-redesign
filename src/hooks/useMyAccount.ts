import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";
import { getMyAccount, type MyAccount } from "@/api/account";

/** Профиль текущего пользователя для ProfilePage. reload() - после сохранения. */
export function useMyAccount(client: RedmineClient | null) {
  const [account, setAccount] = useState<MyAccount | null>(null);
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
