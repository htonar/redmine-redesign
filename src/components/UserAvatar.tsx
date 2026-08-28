import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getGravatarUrl } from "@/lib/gravatar";
import { avatarColorClass, initialsFromName } from "@/lib/user-display";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name: string;
  /** Если известен - подставляем Gravatar, при 404 откат на инициалы. */
  email?: string;
  /** Классы для размера, напр. "size-5". */
  className?: string;
}

/**
 * Аватарка пользователя для списков/пикеров (issue #44). Gravatar - только
 * если передан email (в большинстве мест REST Redmine его не отдаёт),
 * иначе цветной кружок с инициалами. Цвет детерминирован по имени.
 */
export function UserAvatar({ name, email, className }: UserAvatarProps) {
  return (
    <Avatar size="sm" className={cn("shrink-0", className)}>
      {email && <AvatarImage src={getGravatarUrl(email, 48)} alt="" />}
      <AvatarFallback
        className={cn("font-medium", avatarColorClass(name))}
      >
        {initialsFromName(name)}
      </AvatarFallback>
    </Avatar>
  );
}
