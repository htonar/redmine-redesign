/**
 * Можно ли править/удалять запись трудозатрат - в Redmine оба действия
 * (edit и delete) обслуживаются одним и тем же правом
 * (`TimeEntry#editable_by?`, отдельного `delete_time_entries` не
 * существует), см. docs/permissions.md и CLAUDE.md ("Права доступа").
 *
 * `edit_time_entries` - разрешает править/удалять любую запись проекта;
 * `edit_own_time_entries` - только свою.
 */
export function canManageTimeEntry(
  entry: { user?: { id?: number } | null; project?: { id?: number } | null },
  currentUserId: number | null | undefined,
  can: (permission: string, projectId: number | null | undefined) => boolean,
): boolean {
  const projectId = entry.project?.id;
  if (can("edit_time_entries", projectId)) return true;
  return (
    currentUserId != null &&
    entry.user?.id === currentUserId &&
    can("edit_own_time_entries", projectId)
  );
}
