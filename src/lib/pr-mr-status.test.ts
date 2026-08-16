import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrMrLink } from "./pr-mr-links";

const isTauriMock = vi.fn(() => false);
const tauriFetchMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => isTauriMock(),
}));

vi.mock("../api/tauriFetch", () => ({
  tauriFetch: (request: Request) => tauriFetchMock(request),
}));

import { clearPrMrStatusCache, getPrMrStatus } from "./pr-mr-status";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const githubLink: PrMrLink = {
  platform: "github",
  url: "https://github.com/acme/widgets/pull/42",
  number: 42,
  host: "github.com",
  owner: "acme",
  repo: "widgets",
};

const githubEnterpriseLink: PrMrLink = {
  platform: "github",
  url: "https://ghe.acme.internal/acme/widgets/pull/7",
  number: 7,
  host: "ghe.acme.internal",
  owner: "acme",
  repo: "widgets",
};

const gitlabLink: PrMrLink = {
  platform: "gitlab",
  url: "https://gitlab.com/acme/group/widgets/-/merge_requests/9",
  number: 9,
  host: "gitlab.com",
  projectPath: "acme/group/widgets",
};

describe("getPrMrStatus", () => {
  beforeEach(() => {
    clearPrMrStatusCache();
    isTauriMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("возвращает open для обычного открытого GitHub PR", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ state: "open", merged: false, draft: false }));
    vi.stubGlobal("fetch", fetchMock);

    const status = await getPrMrStatus(githubLink, { tokens: {} });

    expect(status).toBe("open");
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/acme/widgets/pulls/42");
  });

  it("возвращает draft для GitHub PR с draft: true", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ state: "open", merged: false, draft: true }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await getPrMrStatus(githubLink, { tokens: {} })).toBe("draft");
  });

  it("возвращает merged для смерженного GitHub PR", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ state: "closed", merged: true, draft: false }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await getPrMrStatus(githubLink, { tokens: {} })).toBe("merged");
  });

  it("возвращает closed для закрытого без мерджа GitHub PR", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ state: "closed", merged: false, draft: false }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await getPrMrStatus(githubLink, { tokens: {} })).toBe("closed");
  });

  it("добавляет Authorization-заголовок, когда есть GitHub-токен", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ state: "open", merged: false, draft: false }));
    vi.stubGlobal("fetch", fetchMock);

    await getPrMrStatus(githubLink, { tokens: { github: "ghp_secret" } });

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer ghp_secret");
  });

  it("для self-hosted GitHub Enterprise ходит на /api/v3", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ state: "open", merged: false, draft: false }));
    vi.stubGlobal("fetch", fetchMock);

    await getPrMrStatus(githubEnterpriseLink, { tokens: {} });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ghe.acme.internal/api/v3/repos/acme/widgets/pulls/7");
  });

  it("в вебе ходит на GitLab через /proxy/* с X-Proxy-Target и Private-Token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ state: "opened", merged: false, draft: false }));
    vi.stubGlobal("fetch", fetchMock);

    const status = await getPrMrStatus(gitlabLink, {
      tokens: { gitlab: "glpat-secret" },
      proxyUrl: "http://localhost:8787",
    });

    expect(status).toBe("open");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8787/proxy/api/v4/projects/acme%2Fgroup%2Fwidgets/merge_requests/9",
    );
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Proxy-Target"]).toBe("https://gitlab.com");
    expect(headers["Private-Token"]).toBe("glpat-secret");
  });

  it("маппит GitLab merged/closed/draft (work_in_progress) статусы", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockResolvedValueOnce(jsonResponse({ state: "merged" }));
    expect(
      await getPrMrStatus(
        { ...gitlabLink, url: gitlabLink.url + "-a" },
        { tokens: {}, proxyUrl: "http://localhost:8787" },
      ),
    ).toBe("merged");

    fetchMock.mockResolvedValueOnce(jsonResponse({ state: "closed" }));
    expect(
      await getPrMrStatus(
        { ...gitlabLink, url: gitlabLink.url + "-b" },
        { tokens: {}, proxyUrl: "http://localhost:8787" },
      ),
    ).toBe("closed");

    fetchMock.mockResolvedValueOnce(jsonResponse({ state: "opened", work_in_progress: true }));
    expect(
      await getPrMrStatus(
        { ...gitlabLink, url: gitlabLink.url + "-c" },
        { tokens: {}, proxyUrl: "http://localhost:8787" },
      ),
    ).toBe("draft");
  });

  it("без proxyUrl в вебе не может достучаться до GitLab - тихо возвращает undefined", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const status = await getPrMrStatus(gitlabLink, { tokens: {} });

    expect(status).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("в Tauri ходит на GitLab напрямую через tauriFetch, без proxyUrl", async () => {
    isTauriMock.mockReturnValue(true);
    tauriFetchMock.mockResolvedValue(jsonResponse({ state: "opened" }));

    const status = await getPrMrStatus(gitlabLink, { tokens: { gitlab: "glpat-secret" } });

    expect(status).toBe("open");
    const [request] = tauriFetchMock.mock.calls[0];
    expect(request.url).toBe(
      "https://gitlab.com/api/v4/projects/acme%2Fgroup%2Fwidgets/merge_requests/9",
    );
    expect(request.headers.get("private-token")).toBe("glpat-secret");
  });

  it("при сетевой ошибке тихо возвращает undefined", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    expect(await getPrMrStatus(githubLink, { tokens: {} })).toBeUndefined();
  });

  it("при HTTP-ошибке (например истекший токен) тихо возвращает undefined", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "Bad credentials" }, 401));
    vi.stubGlobal("fetch", fetchMock);

    expect(await getPrMrStatus(githubLink, { tokens: { github: "expired" } })).toBeUndefined();
  });

  it("кэширует результат на сессию - повторный вызов не бьет сеть снова", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ state: "open", merged: false, draft: false }));
    vi.stubGlobal("fetch", fetchMock);

    await getPrMrStatus(githubLink, { tokens: {} });
    await getPrMrStatus(githubLink, { tokens: {} });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
