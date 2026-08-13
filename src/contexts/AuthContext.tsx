import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { createRedmineClient, type RedmineClient } from "@/api/client";
import {
  fetchPermissions,
  type ProjectRoles,
  type RolePermissions,
} from "@/api/permissions";
import {
  clearCredentials,
  loadCredentials,
  normalizeBaseUrl,
  saveCredentials,
} from "@/lib/auth-storage";

export interface AuthUser {
  id: number;
  login: string;
  firstname: string;
  lastname: string;
  mail: string;
  admin: boolean;
}

type AuthStatus = "restoring" | "anonymous" | "authenticating" | "authenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  client: RedmineClient | null;
  /** Адрес текущего Redmine-инстанса - нужен, например, для ключа в localStorage. */
  baseUrl: string | null;
  /** Ошибка последней попытки логина - null, пока не было ни одной ошибки. */
  error: string | null;
  login: (baseUrl: string, apiKey: string) => Promise<void>;
  logout: () => void;
  /**
   * Есть ли у текущего пользователя право `permission` (машинный ключ Redmine,
   * например "delete_issues") на проекте `projectId` - см. docs/permissions.md.
   * Пока права не загрузились (permissionsLoading) - возвращает false, чтобы
   * не показывать контролы, которые сразу же придется прятать обратно.
   * Админ (`user.admin`) обходит проверку - ему можно всё.
   */
  can: (permission: string, projectId: number | null | undefined) => boolean;
  /** Права грузятся отдельным запросом после логина - см. loadPermissions. */
  permissionsLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * URL прокси-сервера (server/) - см. CLAUDE.md "CORS и прокси-бэкенд". Без
 * него запросы к большинству реальных Redmine-инстансов блокируются CORS.
 * Не задан - работаем как раньше, напрямую (годится для инстансов, у которых
 * CORS настроен, или для локальной разработки).
 */
const PROXY_URL = import.meta.env.VITE_REDMINE_PROXY_URL;

/**
 * Ходит в GET /my/account.json с переданным клиентом - так проверяем, что
 * API-ключ действительно валиден, а не просто сохранен локально.
 */
function getMyAccount(client: RedmineClient) {
  return client.GET("/my/account.{format}", {
    params: { path: { format: "json" } },
  });
}

async function fetchAccount(client: RedmineClient): Promise<AuthUser> {
  let result: Awaited<ReturnType<typeof getMyAccount>>;

  try {
    result = await getMyAccount(client);
  } catch {
    // fetch() падает исключением при сетевых проблемах (недоступный хост, CORS
    // и т.п.) - это не то же самое, что ответ 401/403 от самого Redmine.
    throw new Error(
      "Не удалось подключиться по этому адресу. Проверьте, что адрес правильный и Redmine доступен из браузера (в т.ч. настройки CORS).",
    );
  }

  const { data, error, response } = result;

  if (error || !data) {
    if (response.status === 401) {
      throw new Error("Неверный API-ключ или он отозван.");
    }
    throw new Error(
      `Не удалось подключиться к Redmine (${response.status}). Проверьте адрес инстанса.`,
    );
  }

  const { user } = data;
  return {
    id: user.id,
    login: user.login,
    firstname: user.firstname,
    lastname: user.lastname,
    mail: user.mail,
    admin: user.admin ?? false,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [client, setClient] = useState<RedmineClient | null>(null);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectRoles, setProjectRoles] = useState<ProjectRoles>({});
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>({});
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  /**
   * Отдельный запрос после успешного логина/восстановления сессии - права не
   * нужны для самого входа, поэтому не блокируют его. Админа не запрашиваем -
   * ему можно всё, can() полагается на account.admin напрямую.
   */
  function loadPermissions(activeClient: RedmineClient, isAdmin: boolean) {
    if (isAdmin) {
      setProjectRoles({});
      setRolePermissions({});
      return;
    }
    setPermissionsLoading(true);
    fetchPermissions(activeClient)
      .then(({ projectRoles, rolePermissions }) => {
        setProjectRoles(projectRoles);
        setRolePermissions(rolePermissions);
      })
      .catch(() => {
        // Права - только для UX (прятать недоступные кнопки), не критично для
        // работы приложения - молча оставляем пустыми, can() вернет false.
      })
      .finally(() => setPermissionsLoading(false));
  }

  useEffect(() => {
    const stored = loadCredentials();
    if (!stored) {
      setStatus("anonymous");
      return;
    }

    const restoredClient = createRedmineClient({
      baseUrl: stored.baseUrl,
      auth: { apiKey: stored.apiKey },
      proxyUrl: PROXY_URL,
    });

    fetchAccount(restoredClient)
      .then((account) => {
        setClient(restoredClient);
        setUser(account);
        setBaseUrl(stored.baseUrl);
        setStatus("authenticated");
        loadPermissions(restoredClient, account.admin);
      })
      .catch(() => {
        // сохраненный ключ больше не работает - тихо очищаем и просим войти заново
        clearCredentials();
        setStatus("anonymous");
      });
  }, []);

  const login = useCallback(async (rawBaseUrl: string, apiKey: string) => {
    setStatus("authenticating");
    setError(null);

    const baseUrl = normalizeBaseUrl(rawBaseUrl);
    const newClient = createRedmineClient({
      baseUrl,
      auth: { apiKey },
      proxyUrl: PROXY_URL,
    });

    try {
      const account = await fetchAccount(newClient);
      saveCredentials({ baseUrl, apiKey });
      setClient(newClient);
      setUser(account);
      setBaseUrl(baseUrl);
      setStatus("authenticated");
      loadPermissions(newClient, account.admin);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось войти.");
      setStatus("anonymous");
    }
  }, []);

  const logout = useCallback(() => {
    clearCredentials();
    setClient(null);
    setUser(null);
    setBaseUrl(null);
    setError(null);
    setStatus("anonymous");
    setProjectRoles({});
    setRolePermissions({});
  }, []);

  const can = useCallback(
    (permission: string, projectId: number | null | undefined): boolean => {
      if (user?.admin) return true;
      if (!projectId) return false;
      const roleIds = projectRoles[projectId];
      if (!roleIds) return false;
      return roleIds.some((roleId) => rolePermissions[roleId]?.includes(permission));
    },
    [user, projectRoles, rolePermissions],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, client, baseUrl, error, login, logout, can, permissionsLoading }),
    [status, user, client, baseUrl, error, login, logout, can, permissionsLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth должен использоваться внутри AuthProvider");
  }
  return ctx;
}
