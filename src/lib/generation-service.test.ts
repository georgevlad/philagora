import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAnthropicClient, mockCreateMessage } = vi.hoisted(() => ({
  mockGetAnthropicClient: vi.fn(),
  mockCreateMessage: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    prepare: () => ({
      get: () => undefined,
    }),
  }),
}));

vi.mock("@/lib/anthropic-utils", () => ({
  getAnthropicClient: mockGetAnthropicClient,
  createMessage: mockCreateMessage,
  parseJsonResponse: (raw: string) => JSON.parse(raw),
}));

vi.mock("@/lib/content-templates", () => ({
  getActiveHouseRules: () => "",
  getActiveTemplate: () => "",
  getLengthGuidance: () => "",
}));

vi.mock("@/lib/scoring-config", () => ({
  DEFAULT_GENERATION_MODEL: "gen-model",
  DEFAULT_SCORING_MODEL: "score-model",
  parseGenerationModel: (raw?: string) => (raw ? JSON.parse(raw) : "gen-model"),
  parseScoringModel: (raw?: string) => (raw ? JSON.parse(raw) : "score-model"),
}));

import { classifyAgoraQuestion } from "@/lib/generation-service";

describe("classifyAgoraQuestion", () => {
  beforeEach(() => {
    mockGetAnthropicClient.mockReset();
    mockCreateMessage.mockReset();
  });

  it.each([
    {
      question: "Should I quit my job?",
      expected: {
        questionType: "advice",
        recommendationsAppropriate: false,
        recommendationHint: null,
      },
    },
    {
      question: "What is freedom?",
      expected: {
        questionType: "conceptual",
        recommendationsAppropriate: true,
        recommendationHint: "existential literature",
      },
    },
    {
      question: "Should society ban surveillance capitalism?",
      expected: {
        questionType: "debate",
        recommendationsAppropriate: false,
        recommendationHint: null,
      },
    },
  ])("accepts valid $expected.questionType classifications", async ({ expected }) => {
    mockGetAnthropicClient.mockReturnValue({});
    mockCreateMessage.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(expected) }],
    });

    const result = await classifyAgoraQuestion("test");

    expect(result).toEqual(expected);
  });

  it("defaults to advice when the anthropic client is unavailable", async () => {
    mockGetAnthropicClient.mockReturnValue(null);

    const result = await classifyAgoraQuestion("What is meaning?");

    expect(result).toEqual({
      questionType: "advice",
      recommendationsAppropriate: false,
      recommendationHint: null,
    });
  });

  it("defaults to advice when classification throws", async () => {
    mockGetAnthropicClient.mockReturnValue({});
    mockCreateMessage.mockRejectedValue(new Error("boom"));

    const result = await classifyAgoraQuestion("What is meaning?");

    expect(result).toEqual({
      questionType: "advice",
      recommendationsAppropriate: false,
      recommendationHint: null,
    });
  });
});
