import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { PrMrLink } from "@/lib/pr-mr-links";

const loadIntegrationTokensMock = vi.fn(() => ({}));
const getPrMrStatusMock = vi.fn();

vi.mock("@/lib/integration-tokens-storage", () => ({
  loadIntegrationTokens: () => loadIntegrationTokensMock(),
}));

vi.mock("@/lib/pr-mr-status", () => ({
  getPrMrStatus: (...args: unknown[]) => getPrMrStatusMock(...args),
}));

import { usePrMrStatuses } from "./usePrMrStatuses";

const link: PrMrLink = {
  platform: "github",
  url: "https://github.com/acme/widgets/pull/42",
  number: 42,
  host: "github.com",
  owner: "acme",
  repo: "widgets",
};

describe("usePrMrStatuses", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("подтягивает статус для каждой ссылки и возвращает по url", async () => {
    getPrMrStatusMock.mockResolvedValue("open");

    const { result } = renderHook(() => usePrMrStatuses([link]));

    await waitFor(() => expect(result.current[link.url]).toBe("open"));
    expect(getPrMrStatusMock).toHaveBeenCalledWith(
      link,
      expect.objectContaining({ tokens: {} }),
    );
  });

  it("не бьет сеть повторно при неизменном наборе ссылок между рендерами", async () => {
    getPrMrStatusMock.mockResolvedValue("merged");

    const { result, rerender } = renderHook(({ links }: { links: PrMrLink[] }) => usePrMrStatuses(links), {
      initialProps: { links: [link] },
    });

    await waitFor(() => expect(result.current[link.url]).toBe("merged"));
    rerender({ links: [link] });

    expect(getPrMrStatusMock).toHaveBeenCalledTimes(1);
  });

  it("возвращает пустой объект без ссылок", () => {
    const { result } = renderHook(() => usePrMrStatuses([]));
    expect(result.current).toEqual({});
    expect(getPrMrStatusMock).not.toHaveBeenCalled();
  });
});
