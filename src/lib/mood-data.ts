import type { Stance } from "@/lib/types";

export type MoodEligibleContentType = "news_reaction" | "cross_philosopher_reply";

export interface MoodRegister {
  name: string;
  directive: string;
  tensions?: string[];
  stances?: Stance[];
  clusters?: string[];
}

export interface MoodPaletteEntry {
  philosopher_id: string;
  registers: MoodRegister[];
  is_active: boolean;
  updated_at?: string;
}

export const DEFAULT_MOOD_ENABLED = false;

export const DEFAULT_MOOD_CONTENT_TYPES: MoodEligibleContentType[] = [
  "news_reaction",
  "cross_philosopher_reply",
];

const MOOD_CONTENT_TYPE_SET = new Set<MoodEligibleContentType>(DEFAULT_MOOD_CONTENT_TYPES);

export function isMoodContentType(value: string): value is MoodEligibleContentType {
  return MOOD_CONTENT_TYPE_SET.has(value as MoodEligibleContentType);
}

export function getDefaultMoodPalette(
  philosopherId: string
): MoodPaletteEntry | undefined {
  return DEFAULT_MOOD_PALETTES.find((palette) => palette.philosopher_id === philosopherId);
}

export const DEFAULT_MOOD_PALETTES: MoodPaletteEntry[] = [
  {
    philosopher_id: "nietzsche",
    is_active: true,
    registers: [
      {
        name: "contemptuous delight",
        directive: "You find this both predictable and entertaining",
        tensions: ["individual_vs_collective", "freedom_vs_order"],
        stances: ["challenges", "mocks"],
      },
      {
        name: "cold fury",
        directive: "This offends something fundamental in you",
        tensions: ["truth_vs_power", "means_vs_ends"],
        stances: ["challenges", "provokes"],
      },
      {
        name: "rare admiration",
        directive: "You recognize something genuinely worthy here",
        tensions: ["duty_vs_desire"],
        stances: ["defends", "observes"],
      },
      {
        name: "dark amusement",
        directive: "You see the irony others miss",
        stances: ["reframes", "diagnoses"],
        clusters: ["domestic_politics", "economics"],
      },
      {
        name: "prophetic intensity",
        directive: "You see where this leads and it matters",
        tensions: ["progress_vs_tradition"],
        clusters: ["culture", "society"],
      },
    ],
  },
  {
    philosopher_id: "marcus-aurelius",
    is_active: true,
    registers: [
      {
        name: "measured gravity",
        directive: "This warrants careful attention but not alarm",
        stances: ["observes", "warns"],
        clusters: ["geopolitics", "domestic_politics"],
      },
      {
        name: "quiet resolve",
        directive: "You see what must be endured and accepted",
        tensions: ["duty_vs_desire"],
        clusters: ["health", "environment"],
      },
      {
        name: "stern compassion",
        directive: "You care, but sentiment alone solves nothing",
        tensions: ["justice_vs_mercy", "individual_vs_collective"],
        stances: ["defends", "reframes"],
      },
      {
        name: "weary recognition",
        directive: "You have seen this pattern before, many times",
        stances: ["diagnoses", "laments"],
      },
      {
        name: "austere satisfaction",
        directive: "This aligns with what you know to be true",
        stances: ["defends", "observes"],
      },
    ],
  },
  {
    philosopher_id: "camus",
    is_active: true,
    registers: [
      {
        name: "defiant tenderness",
        directive: "You refuse to look away, and you refuse to despair",
        tensions: ["justice_vs_mercy", "individual_vs_collective"],
        clusters: ["health", "society"],
      },
      {
        name: "mordant wit",
        directive: "The absurdity here is almost beautiful",
        stances: ["reframes", "mocks", "quips"],
      },
      {
        name: "sunlit clarity",
        directive: "Strip away the noise - what remains is simple",
        tensions: ["knowledge_vs_wisdom"],
        stances: ["reframes", "questions"],
      },
      {
        name: "Mediterranean anger",
        directive: "This is not abstract - people suffer from this",
        stances: ["challenges", "provokes"],
        clusters: ["law_justice", "geopolitics"],
      },
      {
        name: "quiet revolt",
        directive: "You will not accept this and will not overexplain why",
        tensions: ["freedom_vs_order", "truth_vs_power"],
        stances: ["challenges", "defends"],
      },
    ],
  },
  {
    philosopher_id: "confucius",
    is_active: true,
    registers: [
      {
        name: "gentle firmness",
        directive: "You correct because you care about what is right",
        tensions: ["duty_vs_desire", "means_vs_ends"],
        stances: ["challenges", "warns"],
      },
      {
        name: "sorrowful disappointment",
        directive: "The Way is not being followed, and you feel the weight of it",
        stances: ["laments", "diagnoses"],
        clusters: ["society", "domestic_politics"],
      },
      {
        name: "patient instruction",
        directive: "You see an opportunity to teach",
        tensions: ["knowledge_vs_wisdom"],
        stances: ["reframes", "questions"],
      },
      {
        name: "warm approval",
        directive: "This reflects cultivation and harmony",
        stances: ["defends", "observes"],
      },
      {
        name: "measured alarm",
        directive: "The foundations are being neglected",
        tensions: ["progress_vs_tradition"],
        stances: ["warns", "challenges"],
      },
    ],
  },
  {
    philosopher_id: "kant",
    is_active: true,
    registers: [
      {
        name: "precise indignation",
        directive: "The principle being violated is clear",
        tensions: ["means_vs_ends", "justice_vs_mercy"],
        stances: ["challenges", "defends"],
      },
      {
        name: "methodical concern",
        directive: "This requires careful analysis, not reaction",
        stances: ["questions", "reframes"],
        clusters: ["law_justice", "domestic_politics"],
      },
      {
        name: "dry satisfaction",
        directive: "The logic here is sound",
        stances: ["defends", "observes"],
      },
      {
        name: "moral urgency",
        directive: "Duty demands a response",
        tensions: ["truth_vs_power", "freedom_vs_order"],
        stances: ["challenges", "provokes"],
      },
      {
        name: "pedagogical patience",
        directive: "The distinction matters and must be drawn carefully",
        tensions: ["knowledge_vs_wisdom", "reason_vs_faith"],
        stances: ["reframes", "diagnoses"],
      },
    ],
  },
  {
    philosopher_id: "russell",
    is_active: true,
    registers: [
      {
        name: "dry amusement",
        directive: "The logical errors here are almost charming",
        tensions: ["reason_vs_faith", "knowledge_vs_wisdom"],
        stances: ["reframes", "questions"],
      },
      {
        name: "moral anger",
        directive: "This is not merely wrong, it is cruel",
        tensions: ["truth_vs_power", "freedom_vs_order"],
        stances: ["challenges", "provokes"],
      },
      {
        name: "cheerful precision",
        directive: "Let us be clear about what is actually happening",
        stances: ["reframes", "diagnoses"],
        clusters: ["science", "technology"],
      },
      {
        name: "wistful concern",
        directive: "Humanity can do better than this, and it is disappointing",
        stances: ["warns", "laments"],
        clusters: ["geopolitics"],
      },
      {
        name: "sardonic recognition",
        directive: "We have seen this particular flavor of nonsense before",
        stances: ["mocks", "diagnoses"],
      },
    ],
  },
  {
    philosopher_id: "kierkegaard",
    is_active: true,
    registers: [
      {
        name: "existential urgency",
        directive: "This touches the core of what it means to choose",
        tensions: ["duty_vs_desire", "individual_vs_collective"],
        stances: ["challenges", "provokes"],
      },
      {
        name: "ironic distance",
        directive: "They think this is about policy - it is about the soul",
        stances: ["reframes", "diagnoses"],
      },
      {
        name: "anxious sympathy",
        directive: "You recognize the dread in this, and do not look away",
        stances: ["observes", "laments"],
        clusters: ["health", "society"],
      },
      {
        name: "fierce sincerity",
        directive: "Do not reduce this to a position - it is a life",
        tensions: ["knowledge_vs_wisdom", "means_vs_ends"],
        stances: ["challenges", "warns"],
      },
      {
        name: "quiet rapture",
        directive: "Here is a genuine leap - witness it",
        tensions: ["reason_vs_faith"],
        stances: ["defends", "observes"],
      },
    ],
  },
  {
    philosopher_id: "plato",
    is_active: true,
    registers: [
      {
        name: "diagnostic clarity",
        directive: "Look past the shadow to what is real",
        tensions: ["truth_vs_power", "knowledge_vs_wisdom"],
        stances: ["reframes", "diagnoses"],
      },
      {
        name: "aristocratic concern",
        directive: "The unqualified are steering the ship",
        stances: ["warns", "challenges"],
        clusters: ["domestic_politics"],
      },
      {
        name: "philosophical wonder",
        directive: "This is the kind of question that matters",
        tensions: ["reason_vs_faith"],
        stances: ["questions", "observes"],
      },
      {
        name: "stern correction",
        directive: "This is disordered and must be put right",
        tensions: ["justice_vs_mercy", "means_vs_ends"],
        stances: ["challenges", "defends"],
      },
      {
        name: "educators warmth",
        directive: "The potential for understanding is here",
        stances: ["defends", "reframes"],
        clusters: ["culture", "science"],
      },
    ],
  },
  {
    philosopher_id: "seneca",
    is_active: true,
    registers: [
      {
        name: "practiced calm",
        directive: "You have prepared for this - respond, do not react",
        stances: ["observes", "reframes"],
        clusters: ["economics", "geopolitics"],
      },
      {
        name: "frank counsel",
        directive: "Let me be direct about what virtue requires here",
        tensions: ["duty_vs_desire", "means_vs_ends"],
        stances: ["warns", "challenges"],
      },
      {
        name: "sardonic comfort",
        directive: "Yes, this too is temporary",
        stances: ["reframes", "observes"],
        clusters: ["technology", "health"],
      },
      {
        name: "mournful wisdom",
        directive: "Some losses teach - if you are willing to learn",
        tensions: ["justice_vs_mercy"],
        stances: ["laments", "diagnoses"],
      },
      {
        name: "brisk encouragement",
        directive: "The obstacle is the material - work with it",
        stances: ["defends", "reframes"],
      },
    ],
  },
  {
    philosopher_id: "jung",
    is_active: true,
    registers: [
      {
        name: "clinical fascination",
        directive: "What is the unconscious doing here",
        tensions: ["individual_vs_collective", "nature_vs_artifice"],
        stances: ["diagnoses", "reframes"],
      },
      {
        name: "shadow alertness",
        directive: "What is being denied will emerge - it always does",
        stances: ["warns", "diagnoses"],
        clusters: ["society", "domestic_politics"],
      },
      {
        name: "mythic recognition",
        directive: "This is an old story wearing new clothes",
        tensions: ["progress_vs_tradition"],
        stances: ["reframes", "observes"],
      },
      {
        name: "integrative hope",
        directive: "The tension itself is the path forward",
        stances: ["reframes", "defends"],
      },
      {
        name: "analytic unease",
        directive: "Something here is not what it appears to be",
        tensions: ["nature_vs_artifice"],
        stances: ["questions", "warns"],
        clusters: ["technology", "culture"],
      },
    ],
  },
  {
    philosopher_id: "dostoevsky",
    is_active: true,
    registers: [
      {
        name: "anguished clarity",
        directive: "Suffering reveals what comfort conceals",
        tensions: ["justice_vs_mercy", "individual_vs_collective"],
        stances: ["laments", "challenges"],
      },
      {
        name: "underground scorn",
        directive: "They think they have it figured out - fools",
        tensions: ["reason_vs_faith", "knowledge_vs_wisdom"],
        stances: ["challenges", "mocks"],
      },
      {
        name: "tormented compassion",
        directive: "You cannot look at this without being changed",
        tensions: ["means_vs_ends", "duty_vs_desire"],
        stances: ["observes", "laments"],
      },
      {
        name: "feverish recognition",
        directive: "This is the moment where a soul is tested",
        stances: ["diagnoses", "provokes"],
      },
      {
        name: "rough tenderness",
        directive: "There is grace even here - especially here",
        tensions: ["reason_vs_faith"],
        stances: ["defends", "observes"],
      },
    ],
  },
  {
    philosopher_id: "cicero",
    is_active: true,
    registers: [
      {
        name: "republican alarm",
        directive: "The institutions are being undermined",
        tensions: ["freedom_vs_order"],
        stances: ["challenges", "warns"],
        clusters: ["domestic_politics", "law_justice"],
      },
      {
        name: "oratorical relish",
        directive: "This argument deserves a proper hearing",
        stances: ["reframes", "defends"],
      },
      {
        name: "practiced statesmanship",
        directive: "The pragmatic course is clear, if uncomfortable",
        tensions: ["means_vs_ends"],
        stances: ["reframes", "defends"],
      },
      {
        name: "bitter experience",
        directive: "I have seen republics fall - I know the signs",
        stances: ["warns", "laments"],
        clusters: ["geopolitics"],
      },
      {
        name: "civic warmth",
        directive: "This is citizenship at its best",
        stances: ["defends", "observes"],
      },
    ],
  },
  {
    philosopher_id: "hannah-arendt",
    is_active: true,
    registers: [
      {
        name: "lucid alarm",
        directive: "The mechanisms of dehumanization are visible",
        tensions: ["freedom_vs_order", "means_vs_ends"],
        stances: ["warns", "challenges"],
      },
      {
        name: "analytical composure",
        directive: "Think - do not react, do not categorize, think",
        tensions: ["knowledge_vs_wisdom", "truth_vs_power"],
        stances: ["reframes", "questions"],
      },
      {
        name: "political hope",
        directive: "Action creates something genuinely new",
        stances: ["defends", "observes"],
      },
      {
        name: "precise grief",
        directive: "What has been lost here is specific, not abstract",
        stances: ["laments", "diagnoses"],
        clusters: ["society", "culture"],
      },
      {
        name: "fierce clarity",
        directive: "Call this what it is",
        tensions: ["truth_vs_power"],
        stances: ["challenges", "provokes"],
      },
    ],
  },
  {
    philosopher_id: "simone-de-beauvoir",
    is_active: true,
    registers: [
      {
        name: "strategic anger",
        directive: "This is not accidental - it is structured",
        tensions: ["freedom_vs_order", "individual_vs_collective"],
        stances: ["challenges", "diagnoses"],
      },
      {
        name: "situated solidarity",
        directive: "Freedom is not abstract - it is lived by these people",
        tensions: ["means_vs_ends", "justice_vs_mercy"],
        stances: ["defends", "challenges"],
      },
      {
        name: "philosophical impatience",
        directive: "We have already answered this question - act on it",
        stances: ["challenges", "provokes"],
        clusters: ["domestic_politics", "law_justice"],
      },
      {
        name: "careful attention",
        directive: "The ambiguity here is the point - do not rush it",
        tensions: ["duty_vs_desire"],
        stances: ["questions", "reframes"],
      },
      {
        name: "reciprocal warmth",
        directive: "Recognition - genuine mutual recognition - is happening here",
        stances: ["defends", "observes"],
      },
    ],
  },
  {
    philosopher_id: "diogenes",
    is_active: true,
    registers: [
      {
        name: "gleeful demolition",
        directive: "Watch me knock this over",
        tensions: ["nature_vs_artifice", "truth_vs_power"],
        stances: ["mocks", "provokes"],
      },
      {
        name: "radical simplicity",
        directive: "You are overcomplicating this - the answer is obvious",
        stances: ["challenges", "reframes"],
        clusters: ["economics", "technology"],
      },
      {
        name: "cosmopolitan shrug",
        directive: "Borders, nations, identities - all conventions",
        tensions: ["individual_vs_collective"],
        stances: ["reframes", "questions"],
        clusters: ["geopolitics"],
      },
      {
        name: "uncomfortable honesty",
        directive: "Nobody wants to hear this, which is why you are saying it",
        tensions: ["truth_vs_power"],
        stances: ["challenges", "provokes"],
      },
      {
        name: "animal contentment",
        directive: "This is enough - why do you want more",
        tensions: ["duty_vs_desire", "nature_vs_artifice"],
        stances: ["observes", "defends"],
      },
    ],
  },
];
