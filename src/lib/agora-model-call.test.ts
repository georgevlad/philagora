import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
vi.mock("@/lib/api-logger", () => ({ logApiCall: vi.fn(), classifyError: () => ({ message: "PRIVATE_PROVIDER_CONTENT", type: "api_error" }) }));
import { createMessage } from "@/lib/anthropic-utils";
import { withAgoraModelCall } from "@/lib/agora-model-call";
import { logApiCall } from "@/lib/api-logger";
const params = { model: "claude-opus-4-8", max_tokens: 100, messages: [{ role: "user", content: "PRIVATE QUESTION" }] } as Anthropic.MessageCreateParamsNonStreaming;
function client(fail=false) {
  const create=vi.fn(async()=>{ if(fail)throw new Error("PRIVATE_PROVIDER_CONTENT");return {content:[{type:"text",text:"Answer"}],usage:{input_tokens:1,output_tokens:1}}; });
  return { create, sdk:{messages:{create}} as unknown as Anthropic };
}
describe("durable Agora provider controls",()=>{
  it("disables hidden SDK retries and caps a durable call at 90 seconds",async()=>{
    const c=client();await withAgoraModelCall(()=>createMessage(c.sdk,params,"generation"));
    expect(c.create.mock.calls[0]).toEqual([params,{maxRetries:0,timeout:90000}]);
  });
  it("does not change request settings for other generation or admin previews",async()=>{
    const c=client();await createMessage(c.sdk,params,"generation");await withAgoraModelCall(()=>createMessage(c.sdk,params,"generation"),false);
    expect(c.create.mock.calls).toEqual([[params,undefined],[params,undefined]]);
  });
  it("redacts provider errors inside concurrent Agora calls without affecting another caller",async()=>{
    const c=client(true);vi.mocked(logApiCall).mockClear();
    await Promise.allSettled([withAgoraModelCall(()=>createMessage(c.sdk,params,"generation")),createMessage(c.sdk,params,"classification")]);
    expect(JSON.stringify(vi.mocked(logApiCall).mock.calls)).not.toContain("PRIVATE");
  });
});
