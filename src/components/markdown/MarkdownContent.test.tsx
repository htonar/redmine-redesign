import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";

describe("MarkdownContent", () => {
  it("не рендерит строку со связанными PR/MR, если ссылок нет", () => {
    render(<MarkdownContent text="обычное описание задачи" />);
    expect(screen.queryByText("Связанные:")).not.toBeInTheDocument();
  });

  it("рендерит чип для ссылки на GitHub PR в тексте", () => {
    render(
      <MarkdownContent text="см. https://github.com/acme/widget/pull/42" />,
    );
    expect(screen.getByText("Связанные:")).toBeInTheDocument();
    const chip = screen.getByRole("link", { name: /GitHub PR #42/ });
    expect(chip).toHaveAttribute(
      "href",
      "https://github.com/acme/widget/pull/42",
    );
    expect(chip).toHaveAttribute("target", "_blank");
  });

  it("рендерит отдельные чипы для GitHub PR и GitLab MR одновременно", () => {
    render(
      <MarkdownContent
        text={
          "PR: https://github.com/acme/widget/pull/42, " +
          "MR: https://gitlab.com/acme/widget/-/merge_requests/7"
        }
      />,
    );
    expect(
      screen.getByRole("link", { name: /GitHub PR #42/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /GitLab MR #7/ }),
    ).toBeInTheDocument();
  });

  it("не дублирует чип при повторной ссылке на тот же PR", () => {
    render(
      <MarkdownContent
        text={
          "https://github.com/acme/widget/pull/42 и снова " +
          "https://github.com/acme/widget/pull/42"
        }
      />,
    );
    expect(
      screen.getAllByRole("link", { name: /GitHub PR #42/ }),
    ).toHaveLength(1);
  });
});
