import { AsyncLocalStorage } from "node:async_hooks";
// Applies only to durable Agora work, retaining the shared prompt/model pipeline.
export const agoraModelCall = new AsyncLocalStorage<"durable" | "redact">();
export function withAgoraModelCall<T>(call: () => T, budgeted = true): T {
  return agoraModelCall.run(budgeted ? "durable" : "redact", call);
}
