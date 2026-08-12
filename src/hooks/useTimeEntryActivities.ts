import { useEffect, useState } from "react";
import type { RedmineClient } from "@/api/client";

export interface TimeEntryActivity {
  id: number;
  name: string;
  isDefault: boolean;
}

/** Справочник видов деятельности для дропдауна в форме учета времени. */
export function useTimeEntryActivities(client: RedmineClient | null) {
  const [activities, setActivities] = useState<TimeEntryActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client) {
      setActivities([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    client
      .GET("/enumerations/time_entry_activities.{format}", {
        params: { path: { format: "json" } },
      })
      .then(({ data }) => {
        if (cancelled || !data) return;
        setActivities(
          data.time_entry_activities.map((a) => ({
            id: a.id,
            name: a.name,
            isDefault: a.is_default,
          })),
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client]);

  return { activities, isLoading };
}
