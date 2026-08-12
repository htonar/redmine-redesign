import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";

export interface Tracker {
  id: number;
  name: string;
}

/** Справочник трекеров (тип задачи: Bug/Feature/...) - для форм создания/правки. */
export function useTrackers(client: RedmineClient | null) {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client) {
      setTrackers([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    client
      .GET("/trackers.{format}", { params: { path: { format: "json" } } })
      .then(({ data }) => {
        if (cancelled || !data) return;
        setTrackers(data.trackers.map((t) => ({ id: t.id, name: t.name })));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client]);

  return { trackers, isLoading };
}
