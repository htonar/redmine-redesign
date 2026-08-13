import type { RedmineClient } from "@/api/client";

/** project_id -> id ролей пользователя на этом проекте. */
export type ProjectRoles = Record<number, number[]>;
/** role_id -> машинные ключи прав этой роли ("delete_issues", "edit_issues", ...). */
export type RolePermissions = Record<number, string[]>;

export interface PermissionsData {
  projectRoles: ProjectRoles;
  rolePermissions: RolePermissions;
}

/**
 * Права пользователя по проектам - см. docs/permissions.md (там же список
 * ключей прав, которые нас интересуют). Единого "что мне можно" эндпоинта в
 * Redmine REST API нет: сначала роли пользователя по каждому проекту -
 * `GET /users/current.json?include=memberships` уже учитывает права через
 * группы, отдельно резолвить их не нужно - затем права каждой встретившейся
 * роли (список ролей `GET /roles.json` отдает только id+name, детали - по
 * одной роли за раз, `GET /roles/{id}.json`).
 */
export async function fetchPermissions(client: RedmineClient): Promise<PermissionsData> {
  const { data, error } = await client.GET("/users/current.{format}", {
    params: { path: { format: "json" }, query: { include: ["memberships"] } },
  });

  if (error || !data) {
    throw new Error("Не удалось загрузить права доступа.");
  }

  const projectRoles: ProjectRoles = {};
  const roleIds = new Set<number>();
  for (const membership of data.user.memberships ?? []) {
    if (!membership.project) continue;
    projectRoles[membership.project.id] = membership.roles.map((r) => r.id);
    membership.roles.forEach((r) => roleIds.add(r.id));
  }

  const rolePermissions: RolePermissions = {};
  await Promise.all(
    [...roleIds].map(async (roleId) => {
      const { data: roleData } = await client.GET("/roles/{role_id}.{format}", {
        params: { path: { format: "json", role_id: roleId } },
      });
      if (roleData) rolePermissions[roleId] = roleData.role.permissions;
    }),
  );

  return { projectRoles, rolePermissions };
}
