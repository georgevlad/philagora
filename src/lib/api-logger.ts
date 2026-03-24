/**
 * Lightweight Anthropic API call logger.
 * Logs to both SQLite (queryable from admin) and console (Railway logs).
 */

import { getDb } from "@/lib/db";

export interface ApiCallLogEntry {
  caller: string;
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  maxTokensRequested?: number | null;
  temperature?: number | null;
  stopReason?: string | null;
  latencyMs?: number | null;
  success: boolean;
  errorMessage?: string | null;
  errorType?: string | null;
  systemPromptLength?: number | null;
  userMessageLength?: number | null;
  responseLength?: number | null;
}

export function logApiCall(entry: ApiCallLogEntry): void {
  const status = entry.success ? "OK" : "ERR";
  const hasTokenUsage =
    typeof entry.inputTokens === "number" && typeof entry.outputTokens === "number";
  const tokens = hasTokenUsage ? `${entry.inputTokens}->${entry.outputTokens}tok` : "?tok";
  const latency = typeof entry.latencyMs === "number" ? `${entry.latencyMs}ms` : "?ms";
  const stopInfo = entry.stopReason === "max_tokens" ? " [TRUNCATED]" : "";
  const errorInfo = entry.errorMessage ? ` err=${entry.errorMessage.slice(0, 80)}` : "";

  console.log(
    `[API] ${status} ${entry.caller} | ${entry.model} | ${tokens} | ${latency}${stopInfo}${errorInfo}`
  );

  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO api_call_log (
        caller, model, input_tokens, output_tokens, max_tokens_requested,
        temperature, stop_reason, latency_ms, success, error_message,
        error_type, system_prompt_length, user_message_length, response_length
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      entry.caller,
      entry.model,
      entry.inputTokens ?? null,
      entry.outputTokens ?? null,
      entry.maxTokensRequested ?? null,
      entry.temperature ?? null,
      entry.stopReason ?? null,
      entry.latencyMs ?? null,
      entry.success ? 1 : 0,
      entry.errorMessage ?? null,
      entry.errorType ?? null,
      entry.systemPromptLength ?? null,
      entry.userMessageLength ?? null,
      entry.responseLength ?? null
    );
  } catch (err) {
    console.error("[API Logger] Failed to write log:", err);
  }
}

interface AuthLogEntry {
  action: string;
  success: boolean;
  latencyMs?: number | null;
  errorMessage?: string | null;
  errorType?: string | null;
}

export function logAuthEvent(entry: AuthLogEntry): void {
  const status = entry.success ? "OK" : "ERR";
  const latency = typeof entry.latencyMs === "number" ? `${entry.latencyMs}ms` : "?ms";
  const errorInfo = entry.errorMessage ? ` err=${entry.errorMessage.slice(0, 120)}` : "";

  console.log(`[AUTH] ${status} ${entry.action} | ${latency}${errorInfo}`);

  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO api_call_log (
        caller, model, latency_ms, success, error_message, error_type
      ) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      "better-auth",
      entry.action,
      entry.latencyMs ?? null,
      entry.success ? 1 : 0,
      entry.errorMessage ?? null,
      entry.errorType ?? null
    );
  } catch (err) {
    console.error("[AUTH Logger] Failed to write log:", err);
  }
}

export function classifyError(err: unknown): { message: string; type: string } {
  if (err instanceof Error) {
    const message = err.message;

    if (message.includes("rate_limit") || message.includes("429")) {
      return { message, type: "rate_limit" };
    }
    if (
      message.includes("timeout") ||
      message.includes("ETIMEDOUT") ||
      message.includes("ECONNRESET")
    ) {
      return { message, type: "timeout" };
    }
    if (
      message.includes("authentication") ||
      message.includes("401") ||
      message.includes("invalid_api_key")
    ) {
      return { message, type: "auth_error" };
    }
    if (message.includes("overloaded") || message.includes("529")) {
      return { message, type: "overloaded" };
    }

    return { message, type: "api_error" };
  }

  return { message: String(err), type: "unknown" };
}
