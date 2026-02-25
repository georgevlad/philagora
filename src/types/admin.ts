export interface Philosopher {
  id: string;
  name: string;
  tradition: string;
  color: string;
  initials: string;
}

export type PhiloStatus = "pending" | "generating" | "preview" | "approved";

export interface PhiloState {
  status: PhiloStatus;
  content?: string;
  posts?: string[];
  logId?: number;
  rawOutput?: string;
}
