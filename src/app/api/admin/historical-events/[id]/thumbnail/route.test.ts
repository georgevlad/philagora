import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Database from "better-sqlite3";
import { NextRequest } from "next/server";
import { createTestDb } from "@/lib/__tests__/test-db";
let db: Database.Database;
vi.mock("@/lib/db", () => ({ getDb: () => db }));
vi.mock("@/lib/image-generation", () => ({ buildThumbnailPrompt: () => "Prompt", generateImage: vi.fn(), saveThumbnail: vi.fn(), deleteThumbnail: vi.fn() }));
import { generateImage, saveThumbnail, deleteThumbnail } from "@/lib/image-generation";
import { POST } from "./route";
const generate = () => POST(new NextRequest("http://localhost/api/admin/historical-events/event/thumbnail", { method: "POST" }), { params: Promise.resolve({ id: "event" }) });
beforeEach(() => {
  db = createTestDb(); vi.clearAllMocks();
  db.prepare("INSERT INTO historical_events (id, title, event_month, event_day, display_date, context, thumbnail_filename) VALUES ('event', 'Event', 1, 1, '1 January', 'Context', 'old.png')").run();
  vi.mocked(generateImage).mockResolvedValue({ success: true, imageBase64: "test", mimeType: "image/png", description: "Test image" });
  vi.mocked(saveThumbnail).mockReturnValue("new.png");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { db.close(); vi.restoreAllMocks(); });
describe("historical thumbnail replacement", () => {
  it("preserves the old thumbnail when saving the replacement fails", async () => {
    vi.mocked(saveThumbnail).mockImplementationOnce(() => { throw new Error("private filesystem path"); });
    const response = await generate();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to generate historical thumbnail" });
    expect(deleteThumbnail).not.toHaveBeenCalled();
    expect(db.prepare("SELECT thumbnail_filename FROM historical_events WHERE id = 'event'").get()).toEqual({ thumbnail_filename: "old.png" });
  });
  it("commits the new thumbnail before deleting the old file", async () => {
    vi.mocked(deleteThumbnail).mockImplementationOnce(() => {
      expect(db.prepare("SELECT thumbnail_filename FROM historical_events WHERE id = 'event'").get()).toEqual({ thumbnail_filename: "new.png" });
    });
    expect((await generate()).status).toBe(200);
    expect(deleteThumbnail).toHaveBeenCalledWith("old.png");
  });
  it("retains the replacement when it has the same filename", async () => {
    vi.mocked(saveThumbnail).mockReturnValueOnce("old.png");
    expect((await generate()).status).toBe(200);
    expect(deleteThumbnail).not.toHaveBeenCalled();
  });
});
