import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

const useAuthMock = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

import {
  StatusColorsProvider,
  useStatusColors,
  useStatusToneOverrides,
} from "./StatusColorsContext";

const BASE = "https://redmine.test";

beforeEach(() => {
  localStorage.clear();
  useAuthMock.mockReturnValue({ baseUrl: BASE, user: { id: 5 } });
});
afterEach(() => localStorage.clear());

function wrapper({ children }: { children: ReactNode }) {
  return <StatusColorsProvider>{children}</StatusColorsProvider>;
}

describe("StatusColorsProvider", () => {
  it("setChoice резолвится в overrides и персистится по baseUrl+user", () => {
    const { result } = renderHook(
      () => ({
        ctl: useStatusColors(),
        overrides: useStatusToneOverrides(),
      }),
      { wrapper },
    );

    expect(result.current.overrides).toEqual({});

    act(() => result.current.ctl.setChoice("Заморожен", "info"));

    expect(result.current.overrides).toEqual({ "заморожен": "info" });
    expect(
      JSON.parse(
        localStorage.getItem(`redmine-client:status-colors:${BASE}:5`) ?? "{}",
      ),
    ).toEqual({ "заморожен": "info" });
  });

  it("auto убирает оверрайд, reset чистит всё", () => {
    const { result } = renderHook(() => useStatusColors(), { wrapper });

    act(() => result.current.setChoice("Заморожен", "info"));
    act(() => result.current.setChoice("В работе", "danger"));
    act(() => result.current.setChoice("Заморожен", "auto"));

    expect(result.current.map).toEqual({ "в работе": "danger" });

    act(() => result.current.reset());
    expect(result.current.map).toEqual({});
  });

  it("useStatusToneOverrides вне провайдера - пустая карта, без throw", () => {
    const { result } = renderHook(() => useStatusToneOverrides());
    expect(result.current).toEqual({});
  });

  it("подхватывает уже сохранённые значения при монтировании", () => {
    localStorage.setItem(
      `redmine-client:status-colors:${BASE}:5`,
      JSON.stringify({ "ожидает оплаты": "warning" }),
    );

    let seen: Record<string, string> = {};
    function Probe() {
      seen = useStatusToneOverrides();
      return null;
    }
    render(
      <StatusColorsProvider>
        <Probe />
      </StatusColorsProvider>,
    );

    expect(seen).toEqual({ "ожидает оплаты": "warning" });
  });
});
