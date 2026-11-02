import { focusBody, focusResponse } from "@/lib/in-focus-api";
import { generateFocusVersion } from "@/lib/in-focus-service";
export const maxDuration = 300;
export const POST = (request: Request, context: { params: Promise<{ id: string }> }) => focusResponse(async () => {
  const { id } = await context.params;
  return generateFocusVersion(id, await focusBody(request));
});
