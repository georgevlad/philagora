import { NextResponse } from "next/server";
import { parseAdminJsonObject } from "@/lib/admin-request";
import { FocusError } from "@/lib/in-focus-service";

export async function focusBody(request: Request) {
  const body = await parseAdminJsonObject(request);
  if (!body) throw new FocusError("Request body must be a JSON object.");
  return body;
}
/** These handlers live exclusively under the existing admin middleware gate. */
export async function focusResponse(action: () => unknown | Promise<unknown>) {
  try {
    return NextResponse.json(await action(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (!(error instanceof FocusError)) console.error("In Focus Workshop request failed:", error);
    return NextResponse.json({ error: error instanceof FocusError ? error.message : "Could not complete the workshop request. Try again." },
      { status: error instanceof FocusError ? error.status : 500, headers: { "Cache-Control": "no-store" } });
  }
}
