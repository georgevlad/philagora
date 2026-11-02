/** Shared, browser-safe workshop types. Nothing here is a public content type. */
export const FOCUS_KINDS = ["briefing", "questions", "voices", "argument", "challenge", "reply"] as const;
export type FocusKind = (typeof FOCUS_KINDS)[number];
export const FOCUS_LABELS: Record<FocusKind, string> = {
  briefing: "Briefing", questions: "Question suggestions", voices: "Philosopher suggestions",
  argument: "Main argument", challenge: "Challenge", reply: "Reply",
};

export interface FocusSource {
  id: string;
  title: string;
  url: string;
  publisher: string;
  date: string;
  excerpt: string;
}
export interface FocusState {
  title: string;
  topic: string;
  asOf: string;
  sources: FocusSource[];
  question: string;
  leadId: string;
  challengerId: string;
  selected: Partial<Record<FocusKind, string>>;
}
export interface FocusOutput {
  content?: string;
  questions?: { question: string; reason: string }[];
  voices?: { philosopherId: string; reason: string }[];
}
export interface FocusReference {
  id: string;
  content: string;
  philosopherName: string | null;
}
export interface FocusSnapshot {
  basis: string;
  title: string;
  topic: string;
  asOf: string;
  sources: FocusSource[];
  question: string;
  philosopherId: string | null;
  philosopherName: string | null;
  briefing?: FocusReference;
  argument?: FocusReference;
  challenge?: FocusReference;
  previous?: FocusReference;
  template: string;
}
export interface FocusVersion {
  id: string;
  kind: FocusKind;
  origin: "generated" | "edited";
  status: "generating" | "complete" | "failed";
  output: FocusOutput;
  snapshot: FocusSnapshot;
  feedback: string;
  error: string | null;
  createdAt: string;
}
export interface FocusExperiment {
  id: string;
  state: FocusState;
  revision: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  versions: FocusVersion[];
}
export interface FocusSummary {
  id: string;
  title: string;
  question: string;
  archived: boolean;
  updatedAt: string;
  versionCount: number;
}
export interface FocusPhilosopher {
  id: string;
  name: string;
  tradition: string;
  ready: boolean;
}

export function emptyFocusState(title = ""): FocusState {
  return { title, topic: "", asOf: new Date().toISOString().slice(0, 10), sources: [],
    question: "", leadId: "", challengerId: "", selected: {} };
}

/** Only inputs that affect this step count when deciding whether it needs review. */
export function focusBasis(state: FocusState, kind: FocusKind): string {
  return JSON.stringify({
    topic: state.topic, asOf: state.asOf, sources: state.sources,
    ...(kind !== "briefing" ? { briefing: state.selected.briefing } : {}),
    ...(!["briefing", "questions"].includes(kind) ? { question: state.question } : {}),
    ...(["argument", "reply"].includes(kind) ? { philosopher: state.leadId } : {}),
    ...(kind === "challenge" ? { philosopher: state.challengerId } : {}),
    ...(["challenge", "reply"].includes(kind) ? { argument: state.selected.argument, lead: state.leadId } : {}),
    ...(kind === "reply" ? { challenge: state.selected.challenge, challenger: state.challengerId } : {}),
  });
}

export function selectedFocusVersion(experiment: FocusExperiment, kind: FocusKind) {
  return experiment.versions.find((v) => v.id === experiment.state.selected[kind] && v.status === "complete");
}

export function focusVersionIsStale(state: FocusState, version: FocusVersion): boolean {
  return version.snapshot.basis !== focusBasis(state, version.kind);
}
