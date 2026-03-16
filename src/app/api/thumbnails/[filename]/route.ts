import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { resolveThumbnailPath } from "@/lib/image-generation";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;

  if (!/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filepath = resolveThumbnailPath(filename);
  if (!filepath) {
    return NextResponse.json({ error: "Thumbnail not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filepath);
  const ext = filename.split(".").pop()?.toLowerCase();
  const contentType =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "webp"
      ? "image/webp"
      : "image/png";

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
