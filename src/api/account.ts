import type { RedmineClient } from "@/api/client";

export interface Account {
  id: number;
  login: string;
  admin: boolean;
  firstname: string;
  lastname: string;
  mail: string;
  createdOn: string;
  lastLoginOn: string | null;
}

/** Собственный аккаунт текущего пользователя - GET /my/account.json. */
export async function getMyAccount(client: RedmineClient): Promise<Account> {
  const { data, error } = await client.GET("/my/account.{format}", {
    params: { path: { format: "json" } },
  });

  if (error || !data) {
    throw new Error("Не удалось загрузить профиль.");
  }

  const { user } = data;
  return {
    id: user.id,
    login: user.login,
    admin: user.admin,
    firstname: user.firstname,
    lastname: user.lastname,
    mail: user.mail,
    createdOn: user.created_on,
    lastLoginOn: user.last_login_on,
  };
}

export interface AccountUpdateInput {
  firstname?: string;
  lastname?: string;
  mail?: string;
}

/**
 * Правка своего профиля - PUT /my/account.json, отвечает 204. Только
 * имя/фамилия/email - смена пароля/уведомлений/языка не в фокусе (см.
 * CLAUDE.md, "Приоритеты дальше").
 */
export async function updateMyAccount(
  client: RedmineClient,
  patch: AccountUpdateInput,
): Promise<void> {
  const { error } = await client.PUT("/my/account.{format}", {
    params: { path: { format: "json" } },
    body: { user: patch },
  });

  if (error) {
    throw new Error("Не удалось сохранить профиль.");
  }
}
