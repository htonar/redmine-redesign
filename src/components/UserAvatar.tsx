import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { getGravatarUrl } from "@/lib/gravatar";
import { avatarColorClass, initialsFromName } from "@/lib/user-display";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name: string;
  /** id пользователя в Redmine - для аватарки из плагина redmine_people. */
  userId?: number;
  /** Email - для Gravatar (fallback, если аватарки из плагина нет). */
  email?: string;
  /** Классы размера, напр. "size-5". */
  className?: string;
}

/**
 * Аватарка пользователя для списков/пикеров (issue #44). Пробуем по очереди:
 * 1) картинку из плагина redmine_people (`/people/avatar?id=<uid>` - самый
 *    распространённый плагин аватарок; на инстансах без него 404 -> следующий);
 * 2) Gravatar по email (если email удалось подтянуть);
 * 3) цветной кружок с инициалами (цвет детерминирован по имени).
 */
export function UserAvatar({ name, userId, email, className }: UserAvatarProps) {
  const { baseUrl } = useAuth();

  const sources: string[] = [];
  if (baseUrl && userId) {
    sources.push(`${baseUrl}/people/avatar?id=${userId}&size=64`);
  }
  if (email) sources.push(getGravatarUrl(email, 64));

  const [srcIdx, setSrcIdx] = useState(0);
  const key = sources.join("|");
  useEffect(() => setSrcIdx(0), [key]);

  const src = sources[srcIdx];

  return (
    <Avatar size="sm" className={cn("shrink-0", className)}>
      {src && (
        <AvatarImage
          key={src}
          src={src}
          alt=""
          onLoadingStatusChange={(status) => {
            if (status === "error") setSrcIdx((i) => i + 1);
          }}
        />
      )}
      <AvatarFallback className={cn("font-medium", avatarColorClass(name))}>
        {initialsFromName(name)}
      </AvatarFallback>
    </Avatar>
  );
}
