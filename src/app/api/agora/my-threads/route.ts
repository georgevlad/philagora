import { NextRequest, NextResponse } from "next/server";
import { getIdentityFromHeaders } from "@/lib/auth";
import { getUserAgoraThreads } from "@/lib/data";

export async function GET(request: NextRequest) {
  const identity = await getIdentityFromHeaders(request);

  if (identity.type !== "user") {
    return NextResponse.json({ threads: [] });
  }

  return NextResponse.json({
    threads: getUserAgoraThreads(identity.id),
  });
}
