import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";

const usePrMrStatusesMock = vi.hoisted(() =>
  vi.fn((_links: unknown[]) => ({}) as Record<string, string | undefined>),
);
vi.mock("@/hooks/usePrMrStatuses", () => ({
  usePrMrStatuses: (links: unknown[]) => usePrMrStatusesMock(links),
}));

describe("MarkdownContent", () => {
  afterEach(() => {
    usePrMrStatusesMock.mockReset();
    usePrMrStatusesMock.mockReturnValue({});
  });

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

  it("подсвечивает чип цветом статуса, если статус известен", () => {
    usePrMrStatusesMock.mockReturnValue({
      "https://github.com/acme/widget/pull/42": "merged",
    });
    render(
      <MarkdownContent text="см. https://github.com/acme/widget/pull/42" />,
    );
    const chip = screen.getByRole("link", { name: /GitHub PR #42/ });
    expect(chip).toHaveClass("bg-violet-600");
  });

  it("рендерит <video> для медиа-вложения типа video через extraMedia", () => {
    const { container } = render(
      <MarkdownContent
        text="![clip.mp4](clip.mp4)"
        extraMedia={{ "clip.mp4": { url: "blob:vid", kind: "video" } }}
      />,
    );
    const video = container.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("src", "blob:vid");
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("рендерит <audio> для медиа-вложения типа audio", () => {
    const { container } = render(
      <MarkdownContent
        text="![voice.ogg](voice.ogg)"
        extraMedia={{ "voice.ogg": { url: "blob:snd", kind: "audio" } }}
      />,
    );
    expect(container.querySelector("audio")).toHaveAttribute("src", "blob:snd");
  });

  it("рендерит <img> с blob-URL для картинки и обычный src для внешней ссылки", () => {
    const { container } = render(
      <MarkdownContent
        text={"![a.png](a.png)\n\n![ext](https://example.com/x.png)"}
        extraMedia={{ "a.png": { url: "blob:img", kind: "image" } }}
      />,
    );
    const imgs = container.querySelectorAll("img");
    expect(imgs[0]).toHaveAttribute("src", "blob:img");
    expect(imgs[1]).toHaveAttribute("src", "https://example.com/x.png");
  });

  it("рендерит Textile-картинку `!name!` как <img> с blob-URL вложения", () => {
    const { container } = render(
      <MarkdownContent
        text="скрин: !clipboard-1.png!"
        extraMedia={{ "clipboard-1.png": { url: "blob:c1", kind: "image" } }}
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute("src", "blob:c1");
  });

  it("Textile `!{width: 680px}.name!` -> <img> с шириной 680px", () => {
    const { container } = render(
      <MarkdownContent
        text="!{width: 680px}.pic.png!"
        extraMedia={{ "pic.png": { url: "blob:p", kind: "image" } }}
      />,
    );
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", "blob:p");
    expect(img.style.width).toBe("680px");
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
