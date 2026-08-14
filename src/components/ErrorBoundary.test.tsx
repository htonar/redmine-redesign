import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "@/components/ErrorBoundary";

/** Кидает ошибку при рендере, пока `shouldThrow.current` не станет false. */
function Bomb({ shouldThrow }: { shouldThrow: { current: boolean } }) {
  if (shouldThrow.current) {
    throw new Error("Тестовый сбой рендера");
  }
  return <div>Всё хорошо</div>;
}

describe("ErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("рендерит children, когда ошибки нет", () => {
    render(
      <ErrorBoundary>
        <div>Обычный контент</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Обычный контент")).toBeInTheDocument();
  });

  it("ловит ошибку рендера дочернего компонента и показывает fallback", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const shouldThrow = { current: true };
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={shouldThrow} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Тестовый сбой рендера")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Повторить" }),
    ).toBeInTheDocument();
  });

  it("клик по «Повторить» сбрасывает состояние и даёт детям перерендериться", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const shouldThrow = { current: true };
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={shouldThrow} />
      </ErrorBoundary>,
    );
    expect(
      screen.getByRole("button", { name: "Повторить" }),
    ).toBeInTheDocument();

    shouldThrow.current = false;
    await user.click(screen.getByRole("button", { name: "Повторить" }));

    expect(screen.getByText("Всё хорошо")).toBeInTheDocument();
  });
});
