import { toNextJsHandler } from "better-auth/next-js";
import { auth, ensureBetterAuthTables } from "@/lib/better-auth";
import { logAuthEvent } from "@/lib/api-logger";

const handlers = toNextJsHandler(auth);

function getActionLabel(request: Request): string {
  const { pathname } = new URL(request.url);
  const authPath = pathname.startsWith("/api/auth/")
    ? pathname.slice("/api/auth/".length)
    : pathname.replace(/^\/+/, "");

  return `${request.method} ${authPath || "root"}`;
}

async function readErrorMessage(response: Response): Promise<string | null> {
  if (response.status < 400) {
    return null;
  }

  try {
    const payload = await response.clone().json();
    if (payload && typeof payload === "object" && "message" in payload) {
      const message = payload.message;
      return typeof message === "string" ? message : null;
    }
    if (payload && typeof payload === "object" && "error" in payload) {
      const error = payload.error;
      return typeof error === "string" ? error : null;
    }
  } catch {
    // Fall back to reading plain text below.
  }

  try {
    const text = (await response.clone().text()).trim();
    return text ? text.slice(0, 240) : null;
  } catch {
    return null;
  }
}

async function handleAuthRequest(
  request: Request,
  handler: ((request: Request) => Promise<Response>) | undefined
): Promise<Response> {
  if (!handler) {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const startedAt = Date.now();
  const action = getActionLabel(request);

  try {
    await ensureBetterAuthTables();
    const response = await handler(request);
    const errorMessage = await readErrorMessage(response);

    logAuthEvent({
      action,
      success: response.ok,
      latencyMs: Date.now() - startedAt,
      errorMessage,
      errorType: response.ok ? null : `http_${response.status}`,
    });

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logAuthEvent({
      action,
      success: false,
      latencyMs: Date.now() - startedAt,
      errorMessage,
      errorType: "handler_exception",
    });

    throw error;
  }
}

export async function GET(request: Request) {
  return handleAuthRequest(request, handlers.GET);
}

export async function POST(request: Request) {
  return handleAuthRequest(request, handlers.POST);
}

export async function PATCH(request: Request) {
  return handleAuthRequest(request, handlers.PATCH);
}

export async function PUT(request: Request) {
  return handleAuthRequest(request, handlers.PUT);
}

export async function DELETE(request: Request) {
  return handleAuthRequest(request, handlers.DELETE);
}
