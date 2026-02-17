export const STAFF_APPLICATION_POSITIONS = [
  "moderator",
  "helper",
  "admin",
  "support",
  "builder",
  "other",
] as const;

export type StaffApplicationPosition = (typeof STAFF_APPLICATION_POSITIONS)[number];

export const STAFF_APPLICATION_STATUSES = [
  "pending",
  "accepted",
  "denied",
  "need_more_info",
] as const;

export type StaffApplicationStatus = (typeof STAFF_APPLICATION_STATUSES)[number];

export type StaffApplicationAnswers = {
  minecraftUsername?: string;
  age: number;
  discordTag: string;
  timezone: string;
  serverPlaytime: string;
  availability: string;
  experience: string;
  motivation: string;
  additionalInfo?: string;
  rulesAccepted: boolean;
  [key: string]: unknown;
};

export type StaffApplication = {
  id: string;
  user_id: string;
  status: StaffApplicationStatus;
  position: StaffApplicationPosition;
  answers: StaffApplicationAnswers;
  created_at: string;
  updated_at: string;
  last_edited_at: string | null;
  last_edited_by: string | null;
  latest_revision_number: number;
  revision_count: number;
};

export type StaffApplicationRevision = {
  id: string;
  application_id?: string;
  revision_number: number;
  content_snapshot?: unknown;
  created_at: string;
  created_by: string | null;
  change_reason: string | null;
};

export type StaffApplicationAdminNote = {
  id: string;
  application_id: string;
  admin_id: string | null;
  note: string;
  created_at: string;
};
