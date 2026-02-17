import { joinLinesWithinLimit, truncateText } from "./discord.ts";

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

export type StaffApplicationRow = {
  id: string;
  user_id: string;
  status: StaffApplicationStatus;
  position: StaffApplicationPosition;
  answers: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_edited_at: string | null;
  last_edited_by: string | null;
  latest_revision_number: number;
  revision_count: number;
};

export const sanitizePlainText = (value: string) =>
  (value ?? "")
    .replaceAll("\u0000", "")
    .replace(/[<>]/g, (ch) => (ch === "<" ? "‹" : "›"))
    .replace(/\r\n/g, "\n")
    .trim();

export const safeRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const formatAnswerValue = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const summarizeStaffApplicationAnswers = (answers: Record<string, unknown>) => {
  const a = safeRecord(answers);

  const lines: string[] = [];
  const pushIf = (label: string, key: string, max = 160) => {
    const raw = formatAnswerValue(a[key]);
    if (!raw) return;
    lines.push(`• ${label}: ${truncateText(raw, max)}`);
  };

  pushIf("Minecraft", "minecraftUsername", 48);
  pushIf("Age", "age", 16);
  pushIf("Discord", "discordTag", 64);
  pushIf("Timezone", "timezone", 48);
  pushIf("Server playtime", "serverPlaytime", 120);
  pushIf("Availability", "availability", 220);
  pushIf("Experience", "experience", 300);
  pushIf("Motivation", "motivation", 300);
  pushIf("Other", "additionalInfo", 220);

  if (lines.length === 0) return "No answers provided.";
  return joinLinesWithinLimit(lines, 1000);
};

export const buildAdminApplicationUrl = (input: {
  adminBaseUrl: string | null;
  origin: string | null;
  applicationId: string;
}) => {
  const base =
    (input.adminBaseUrl && input.adminBaseUrl.trim()) ||
    (input.origin && input.origin.trim()) ||
    null;

  if (!base) return null;

  const normalized = base.replace(/\/$/, "");
  // If adminBaseUrl is an origin, append the full path; if it's already the page base, still works.
  if (normalized.endsWith("/admin/staff-applications")) {
    return `${normalized}/${input.applicationId}`;
  }
  return `${normalized}/admin/staff-applications/${input.applicationId}`;
};

export const discordColors = {
  new: 0x3498db,
  edited: 0xf39c12,
  accepted: 0x57f287,
  denied: 0xed4245,
} as const;

export const buildDiscordBodyNewStaffApplication = (input: {
  application: Pick<StaffApplicationRow, "id" | "user_id" | "status" | "position" | "created_at" | "answers">;
  username: string | null;
  editorId: string;
  editorUsername: string | null;
  adminUrl: string | null;
}) => {
  const submittedAt = Math.floor(Date.parse(input.application.created_at) / 1000);
  const userLabel = input.username?.trim() || input.application.user_id;

  const embed: Record<string, unknown> = {
    title: "New Staff Application",
    url: input.adminUrl ?? undefined,
    color: discordColors.new,
    timestamp: new Date().toISOString(),
    fields: [
      { name: "User", value: `**${userLabel}**\n\`${input.application.user_id}\``, inline: false },
      { name: "Position", value: `\`${input.application.position}\``, inline: true },
      { name: "Status", value: `\`${input.application.status}\``, inline: true },
      { name: "Application ID", value: `\`${input.application.id}\``, inline: false },
      ...(Number.isFinite(submittedAt)
        ? [{ name: "Submitted", value: `<t:${submittedAt}:F>`, inline: false }]
        : []),
      { name: "Summary", value: summarizeStaffApplicationAnswers(input.application.answers), inline: false },
    ],
  };

  return {
    content: "A new staff application was submitted.",
    allowed_mentions: { parse: [] },
    embeds: [embed],
    ...(input.adminUrl
      ? {
          components: [
            {
              type: 1,
              components: [{ type: 2, style: 5, label: "Open Application", url: input.adminUrl }],
            },
          ],
        }
      : {}),
  };
};

export const buildDiscordBodyEditedStaffApplication = (input: {
  application: Pick<StaffApplicationRow, "id" | "user_id" | "status" | "position" | "updated_at" | "answers">;
  username: string | null;
  oldSnapshot: { status: string; position: string; answers: Record<string, unknown> };
  editorId: string;
  editorUsername: string | null;
  editedAtIso: string;
  adminUrl: string | null;
}) => {
  const editedAt = Math.floor(Date.parse(input.editedAtIso) / 1000);
  const userLabel = input.username?.trim() || input.application.user_id;
  const editorLabel = input.editorUsername?.trim() || input.editorId;

  const embed: Record<string, unknown> = {
    title: "Application Edited",
    url: input.adminUrl ?? undefined,
    color: discordColors.edited,
    timestamp: new Date().toISOString(),
    description: `Edited by **${editorLabel}** (\`${input.editorId}\`).`,
    fields: [
      { name: "User", value: `**${userLabel}**\n\`${input.application.user_id}\``, inline: false },
      { name: "Position", value: `\`${input.application.position}\``, inline: true },
      { name: "Status", value: `\`${input.application.status}\``, inline: true },
      { name: "Application ID", value: `\`${input.application.id}\``, inline: false },
      ...(Number.isFinite(editedAt) ? [{ name: "Edited", value: `<t:${editedAt}:F>`, inline: false }] : []),
      {
        name: "Old Version",
        value: summarizeStaffApplicationAnswers(input.oldSnapshot.answers),
        inline: false,
      },
      {
        name: "New Version",
        value: summarizeStaffApplicationAnswers(input.application.answers),
        inline: false,
      },
    ],
  };

  return {
    content: "A staff application was edited.",
    allowed_mentions: { parse: [] },
    embeds: [embed],
    ...(input.adminUrl
      ? {
          components: [
            {
              type: 1,
              components: [{ type: 2, style: 5, label: "Open Application", url: input.adminUrl }],
            },
          ],
        }
      : {}),
  };
};
