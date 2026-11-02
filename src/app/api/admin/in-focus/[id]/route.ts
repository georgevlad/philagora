import { focusBody, focusResponse } from "@/lib/in-focus-api";
import { FocusError, focusPhilosophers, focusRevision, getFocusExperiment, saveFocusExperiment } from "@/lib/in-focus-service";
import { getFocusEditionForExperiment } from "@/lib/in-focus-published";
type Context = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export const GET = (_request: Request, context: Context) => focusResponse(async () => {
  const { id } = await context.params;
  return { experiment: getFocusExperiment(id), philosophers: focusPhilosophers(), publishedEdition: getFocusEditionForExperiment(id) };
});
export const PUT = (request: Request, context: Context) => focusResponse(async () => {
  const { id } = await context.params;
  const body = await focusBody(request);
  if (body.archived !== undefined && typeof body.archived !== "boolean") throw new FocusError("Archived must be true or false.");
  return { experiment: saveFocusExperiment(id, body.state, focusRevision(body.expected_revision), body.archived as boolean | undefined) };
});
