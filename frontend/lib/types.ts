export interface Deal {
  id: string;
  name: string;
  company: string;
  contact_name?: string;
  contact_role?: string;
  deal_value?: number;
  currency: string;
  stage: "discovery" | "qualification" | "proposal" | "negotiation" | "closed_won" | "closed_lost";
  hindsight_tags: string[];
  notes?: string;
  total_meetings: number;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  deal_id: string;
  title?: string;
  meeting_date: string;
  duration_seconds?: number;
  transcript?: string;
  processing_status: "pending" | "transcribing" | "extracting" | "storing_memory" | "complete" | "failed";
  processing_error?: string;
  meeting_number?: number;
  created_at: string;
}

export interface ProcessingStatus {
  meeting_id: string;
  status: string;
  step_message: string;
  error?: string;
}
