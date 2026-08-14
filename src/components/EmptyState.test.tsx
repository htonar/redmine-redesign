import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

describe("EmptyState", () => {
  it("рендерит заголовок", () => {
    render(<EmptyState title="Ничего не найдено" />);
    expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
  });

  it("не рендерит описание, если не передано", () => {
    const { container } = render(<EmptyState title="Нет" />);
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("рендерит описание, если передано", () => {
    render(
      <EmptyState
        title="Ничего не найдено"
        description="Попробуйте изменить фильтры"
      />,
    );
    expect(
      screen.getByText("Попробуйте изменить фильтры"),
    ).toBeInTheDocument();
  });

  it("не рендерит иконку, если не передана", () => {
    const { container } = render(<EmptyState title="Нет" />);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("рендерит иконку, если передана", () => {
    const { container } = render(<EmptyState title="Нет" icon={Inbox} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("рендерит action, если передан, и он кликабелен", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <EmptyState
        title="Нет задач"
        action={<button onClick={onClick}>Создать задачу</button>}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Создать задачу" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("size=compact применяет компактные отступы", () => {
    const { container: compact } = render(
      <EmptyState title="Нет" size="compact" />,
    );
    const { container: normal } = render(<EmptyState title="Нет" />);
    expect(compact.firstElementChild?.className).not.toBe(
      normal.firstElementChild?.className,
    );
  });
});
