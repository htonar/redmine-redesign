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
}

type AuthStatus = "restoring" | "anonymous" | "authenticating" | "authenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  client: RedmineClient | null;
  /** Ошибка последней попытки логина - null, пока не было ни одной ошибки. */
  error: string | null;
  login: (baseUrl: string, apiKey: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [client, setClient] = useState<RedmineClient | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadCredentials();
    if (!stored) {
      setStatus("anonymous");
      return;
    }

    const restoredClient = createRedmineClient({
      baseUrl: stored.baseUrl,
      auth: { apiKey: stored.apiKey },
    });

    fetchAccount(restoredClient)
      .then((account) => {
        setClient(restoredClient);
        setUser(account);
        setStatus("authenticated");
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
    const newClient = createRedmineClient({ baseUrl, auth: { apiKey } });

    try {
      const account = await fetchAccount(newClient);
      saveCredentials({ baseUrl, apiKey });
      setClient(newClient);
      setUser(account);
      setStatus("authenticated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось войти.");
      setStatus("anonymous");
    }
  }, []);

  const logout = useCallback(() => {
    clearCredentials();
    setClient(null);
    setUser(null);
    setError(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, client, error, login, logout }),
    [status, user, client, error, login, logout],
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
