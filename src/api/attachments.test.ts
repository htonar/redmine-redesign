import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadAttachment, fetchAttachmentBlob, type Attachment } from "@/api/attachments";
import type { RedmineClient } from "@/api/client";
import * as blobDownload from "@/lib/blob-download";

function mockClient(GET: ReturnType<typeof vi.fn>): RedmineClient {
  return { GET } as unknown as RedmineClient;
}

const attachment: Attachment = {
  id: 7,
  filename: "screenshot.png",
  filesize: 123,
  content_type: "image/png",
  description: null,
  content_url: "https://redmine.example/attachments/download/7/screenshot.png",
  created_on: "2026-01-01T00:00:00Z",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchAttachmentBlob", () => {
  it("запрашивает вложение по id/filename и отдает blob", async () => {
    const blob = new Blob(["x"]);
    const GET = vi.fn().mockResolvedValue({ data: blob });

    const result = await fetchAttachmentBlob(mockClient(GET), attachment);

    expect(GET).toHaveBeenCalledWith(
      "/attachments/download/{attachment_id}/{filename}",
      expect.objectContaining({
        params: { path: { attachment_id: 7, filename: "screenshot.png" } },
        parseAs: "blob",
      }),
    );
    expect(result).toBe(blob);
  });

  it("ошибка/пустой ответ -> кидает с именем файла в сообщении", async () => {
    const GET = vi.fn().mockResolvedValue({ error: new Error("boom") });
    await expect(fetchAttachmentBlob(mockClient(GET), attachment)).rejects.toThrow(
      "screenshot.png",
    );
  });
});

describe("downloadAttachment", () => {
  it("тянет blob и скачивает его под именем вложения", async () => {
    const blob = new Blob(["x"]);
    const GET = vi.fn().mockResolvedValue({ data: blob });
    const downloadBlobSpy = vi.spyOn(blobDownload, "downloadBlob").mockImplementation(() => {});

    await downloadAttachment(mockClient(GET), attachment);

    expect(downloadBlobSpy).toHaveBeenCalledWith(blob, "screenshot.png");
  });
});
