import { focusBody, focusResponse } from "@/lib/in-focus-api";
import { editFocusVersion } from "@/lib/in-focus-service";
export const POST = (request: Request, context: { params: Promise<{ id: string }> }) => focusResponse(async () => {
  const { id } = await context.params;
  return { experiment: editFocusVersion(id, await focusBody(request)) };
});
