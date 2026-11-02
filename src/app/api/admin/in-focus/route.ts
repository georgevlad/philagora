import { focusBody, focusResponse } from "@/lib/in-focus-api";
import { createFocusExperiment, listFocusExperiments } from "@/lib/in-focus-service";

export const dynamic = "force-dynamic";
export const GET = () => focusResponse(() => ({ experiments: listFocusExperiments() }));
export const POST = (request: Request) => focusResponse(async () => {
  const body = await focusBody(request);
  return { experiment: createFocusExperiment(body.title) };
});
