import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttachmentPreviewDialog } from "@/components/issues/AttachmentPreviewDialog";
import type { Attachment } from "@/api/attachments";
import type { RedmineClient } from "@/api/client";

const { fetchAttachmentBlob, downloadAttachment } = vi.hoisted(() => ({
  fetchAttachmentBlob: vi.fn(),
  downloadAttachment: vi.fn(),
}));
vi.mock("@/api/attachments", async () => {
  const actual = await vi.importActual<typeof import("@/api/attachments")>("@/api/attachments");
  return { ...actual, fetchAttachmentBlob, downloadAttachment };
});

const { saveBlobAs } = vi.hoisted(() => ({ saveBlobAs: vi.fn() }));
vi.mock("@/lib/save-file", () => ({ saveBlobAs }));

function makeAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 1,
    filename: "photo.png",
    filesize: 2048,
    content_type: "image/png",
    description: null,
    content_url: "https://redmine.example/attachments/download/1/photo.png",
    created_on: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const client = {} as RedmineClient;

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

afterEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

describe("AttachmentPreviewDialog", () => {
  it("картинка: тянет blob и рендерит <img>", async () => {
    const blob = new Blob(["img"], { type: "image/png" });
    fetchAttachmentBlob.mockResolvedValue(blob);
    URL.createObjectURL = vi.fn().mockReturnValue("blob:preview-url");
    URL.revokeObjectURL = vi.fn();

    render(
      <AttachmentPreviewDialog
        attachment={makeAttachment()}
        client={client}
        open
        onOpenChange={() => {}}
      />,
    );

    const img = await screen.findByRole("img");
    expect(img).toHaveAttribute("src", "blob:preview-url");
    expect(fetchAttachmentBlob).toHaveBeenCalledWith(client, expect.objectContaining({ id: 1 }));
  });

  it("видео: рендерит <video> с src", async () => {
    const blob = new Blob(["vid"], { type: "video/mp4" });
    fetchAttachmentBlob.mockResolvedValue(blob);
    URL.createObjectURL = vi.fn().mockReturnValue("blob:video-url");

    render(
      <AttachmentPreviewDialog
        attachment={makeAttachment({ filename: "clip.mp4", content_type: "video/mp4" })}
        client={client}
        open
        onOpenChange={() => {}}
      />,
    );

    // Dialog рендерится в портал (document.body), не внутрь RTL-контейнера.
    await waitFor(() => {
      expect(document.querySelector("video")).toHaveAttribute("src", "blob:video-url");
    });
  });

  it("текст: тянет blob, показывает содержимое как текст", async () => {
    const blob = new Blob(["hello world"], { type: "text/plain" });
    fetchAttachmentBlob.mockResolvedValue(blob);

    render(
      <AttachmentPreviewDialog
        attachment={makeAttachment({ filename: "notes.txt", content_type: "text/plain", filesize: 11 })}
        client={client}
        open
        onOpenChange={() => {}}
      />,
    );

    expect(await screen.findByText("hello world")).toBeInTheDocument();
  });

  it("большой текстовый файл: не запрашивает blob, показывает сообщение", async () => {
    render(
      <AttachmentPreviewDialog
        attachment={makeAttachment({
          filename: "huge.log",
          content_type: "text/plain",
          filesize: 5 * 1024 * 1024,
        })}
        client={client}
        open
        onOpenChange={() => {}}
      />,
    );

    expect(await screen.findByText(/слишком большой/i)).toBeInTheDocument();
    expect(fetchAttachmentBlob).not.toHaveBeenCalled();
  });

  it("неподдерживаемый тип: не запрашивает blob, показывает заглушку", async () => {
    render(
      <AttachmentPreviewDialog
        attachment={makeAttachment({ filename: "archive.zip", content_type: "application/zip" })}
        client={client}
        open
        onOpenChange={() => {}}
      />,
    );

    expect(await screen.findByText(/предпросмотр недоступен/i)).toBeInTheDocument();
    expect(fetchAttachmentBlob).not.toHaveBeenCalled();
  });

  it("кнопка «Скачать» вызывает downloadAttachment", async () => {
    fetchAttachmentBlob.mockResolvedValue(new Blob(["x"], { type: "application/zip" }));
    const user = userEvent.setup();

    render(
      <AttachmentPreviewDialog
        attachment={makeAttachment({ content_type: "application/zip" })}
        client={client}
        open
        onOpenChange={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: /скачать/i }));
    expect(downloadAttachment).toHaveBeenCalledWith(client, expect.objectContaining({ id: 1 }));
  });

  it("кнопка «Сохранить как» тянет blob (если ещё не тянут) и вызывает saveBlobAs", async () => {
    const blob = new Blob(["x"], { type: "application/zip" });
    fetchAttachmentBlob.mockResolvedValue(blob);
    const user = userEvent.setup();

    render(
      <AttachmentPreviewDialog
        attachment={makeAttachment({ filename: "archive.zip", content_type: "application/zip" })}
        client={client}
        open
        onOpenChange={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: /сохранить как/i }));
    await waitFor(() => {
      expect(saveBlobAs).toHaveBeenCalledWith(blob, "archive.zip");
    });
  });
});
