import type { RedmineClient } from "@/api/client";
import type { components } from "@/api/schema";

export type MyAccount = components["schemas"]["my_account"]["user"];

/**
 * Полная информация об аккаунте текущего пользователя - `GET /my/account.json`.
 * Уже, чем можно было бы ожидать: язык и настройки уведомлений (`mail_notification`,
 * `pref`) принимает `PUT` (см. updateMyAccount ниже), но `GET` их не отдает
 * вообще (ни в спеке, ни в реальном Redmine - это отдельная от User модель
 * настроек, в JSON она не подмешивается). Поэтому страница профиля
 * (ProfilePage) редактирует только то, что реально можно прочитать обратно:
 * имя/фамилию/email - иначе форма показывала бы неверные дефолты.
 */
export async function getMyAccount(client: RedmineClient): Promise<MyAccount> {
  const { data, error } = await client.GET("/my/account.{format}", {
    params: { path: { format: "json" } },
  });

  if (error || !data) {
    throw new Error("Не удалось загрузить профиль.");
  }

  return data.user;
}

export interface MyAccountUpdateInput {
  firstname?: string;
  lastname?: string;
  mail?: string;
}

export async function updateMyAccount(
  client: RedmineClient,
  input: MyAccountUpdateInput,
): Promise<void> {
  const { error } = await client.PUT("/my/account.{format}", {
    params: { path: { format: "json" } },
    body: { user: input },
  });

  if (error) {
    throw new Error("Не удалось сохранить профиль.");
  }
}
