import type {
  AgoraQuestionType,
  AgoraRecommendation,
  AdviceSynthesis,
  ConceptualSynthesis,
  DebateSynthesis,
} from "@/lib/types";

export interface Philosopher {
  id: string;
  name: string;
  tradition: string;
  color: string;
  initials: string;
  is_active?: number;
}

export type PhiloStatus = "pending" | "generating" | "preview" | "approved";

export interface PhiloState {
  status: PhiloStatus;
  content?: string;
  posts?: string[];
  recommendation?: AgoraRecommendation | null;
  logId?: number;
  rawOutput?: string;
}

export type AdminAgoraSynthesisSections =
  | AdviceSynthesis
  | ConceptualSynthesis
  | DebateSynthesis;

export interface AdminAgoraSynthesisData {
  type: AgoraQuestionType;
  sections: AdminAgoraSynthesisSections;
}
