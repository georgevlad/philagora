/** Parse an admin JSON payload without treating malformed input as a server error. */
export async function parseAdminJsonObject(
  request: Pick<Request, "json">
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body !== null && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}
