import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useStatusColors } from "@/contexts/StatusColorsContext";
import { useIssueStatuses } from "@/hooks/useIssueStatuses";
import { statusBadgeClass } from "@/lib/issue-visuals";
import {
  STATUS_TONE_CHOICES,
  normalizeStatusName,
  type StatusColorChoice,
} from "@/lib/status-colors";

/**
 * «Настройки → Цвета статусов» (issue #65). Тон бейджа открытого статуса
 * иначе выводится эвристикой по названию, и незнакомые названия
 * ("Заморожен", "На согласовании у юристов") получают один нейтральный тон.
 * Здесь пользователь назначает тон вручную; хранение - localStorage по
 * baseUrl+user (StatusColorsContext).
 */
export function StatusColorsCard() {
  const { client } = useAuth();
  const { statuses, isLoading } = useIssueStatuses(client);
  const { map, setChoice, reset } = useStatusColors();

  const overriddenCount = Object.keys(map).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between border-b">
        <CardTitle>Цвета статусов</CardTitle>
        {overriddenCount > 0 && (
          <Button variant="ghost" size="sm" onClick={reset}>
            Сбросить всё
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Тон бейджа статуса в списке, канбане, на карточке задачи и в
          отчётах. «Авто» - по названию статуса (в работе - янтарный,
          отклонён - красный и т.п.); для остальных названий вручную.
          Закрытые статусы всегда серые.
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка статусов...</p>
        ) : statuses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Не удалось получить список статусов из Redmine.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {statuses.map((s) => {
              const key = normalizeStatusName(s.name);
              const choice: StatusColorChoice = map[key] ?? "auto";
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge
                      variant="outline"
                      className={statusBadgeClass(
                        { name: s.name, is_closed: s.isClosed },
                        choice === "auto" ? undefined : { [key]: choice },
                      )}
                    >
                      {s.name}
                    </Badge>
                    {s.isClosed && (
                      <span className="text-xs text-muted-foreground">
                        закрытый
                      </span>
                    )}
                  </div>
                  <Select
                    value={choice}
                    onValueChange={(v) =>
                      setChoice(s.name, v as StatusColorChoice)
                    }
                    disabled={s.isClosed}
                  >
                    <SelectTrigger className="w-44 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_TONE_CHOICES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
