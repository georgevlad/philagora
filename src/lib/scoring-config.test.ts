import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCORE_TIERS, DEFAULT_STANCE_GUIDANCE, DEFAULT_TENSION_VOCABULARY,
  parseScoreTiers, parseStanceGuidance, parseTensionVocabulary,
} from "./scoring-config";

describe("stored scoring configuration", () => {
  it.each(["null", "[]", "false", "42", '"text"', "{"])(
    "uses defaults for invalid object configuration: %s", (raw) => {
      expect(parseScoreTiers(raw)).toEqual(DEFAULT_SCORE_TIERS);
      expect(parseStanceGuidance(raw)).toEqual(DEFAULT_STANCE_GUIDANCE);
      expect(parseTensionVocabulary(raw)).toEqual(DEFAULT_TENSION_VOCABULARY);
    },
  );

  it("retains valid tier edits without allowing invalid field types into prompts", () => {
    const parsed = parseScoreTiers(JSON.stringify({
      low: { min: 5, max: "bad", label: "Low priority", description: null },
      good: null, excellent: { min: -1, max: 101 },
    }));
    expect(parsed.low).toEqual({ ...DEFAULT_SCORE_TIERS.low, min: 5, label: "Low priority" });
    expect(parsed.good).toEqual(DEFAULT_SCORE_TIERS.good);
    expect(parsed.excellent).toEqual(DEFAULT_SCORE_TIERS.excellent);
    expect(DEFAULT_SCORE_TIERS.low.min).toBe(1);
  });

  it("ignores invalid tension entries while retaining valid ones", () => {
    expect(parseTensionVocabulary(JSON.stringify([
      null, 5, { label: 42 }, { label: " Truth vs Power ", description: " Details " },
    ]))).toEqual([{ id: "truth_vs_power", label: "Truth vs Power", description: "Details" }]);
  });

  it("validates stance identifiers, pair lengths and text fields", () => {
    expect(parseStanceGuidance(JSON.stringify({
      preferred_friction_pairs: [["challenges", "defends"], ["invalid", "warns"], null, [1, 2]],
      deprioritize: ["warns", "toString", null],
      guidance_text: 42,
    }))).toEqual({
      preferred_friction_pairs: [["challenges", "defends"]],
      deprioritize: ["warns"], guidance_text: DEFAULT_STANCE_GUIDANCE.guidance_text,
    });
  });

  it("preserves intentional empty stance lists", () => {
    const result = parseStanceGuidance('{"preferred_friction_pairs":[],"deprioritize":[]}');
    expect(result.preferred_friction_pairs).toEqual([]);
    expect(result.deprioritize).toEqual([]);
  });
});
