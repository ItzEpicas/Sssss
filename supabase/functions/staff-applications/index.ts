import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.1";
import { z } from "https://esm.sh/zod@3.25.76";

import {
  STAFF_APPLICATION_POSITIONS,
  buildAdminApplicationUrl,
  buildDiscordBodyEditedStaffApplication,
  buildDiscordBodyNewStaffApplication,
  sanitizePlainText,
  safeRecord,
  type StaffApplicationPosition,
  type StaffApplicationRow,
} from "../_shared/staff-applications.ts";
import { postDiscordWebhookWithRetry } from "../_shared/discord.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")?.trim();
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

const DISCORD_WEBHOOK_URL = Deno.env.get("DISCORD_WEBHOOK_URL")?.trim();
const STAFF_APP_ADMIN_URL_BASE = Deno.env.get("STAFF_APP_ADMIN_URL_BASE")?.trim() || null;

const RATE_WINDOW_SECONDS = (() => {
  const raw = Deno.env.get("STAFF_APP_RATE_LIMIT_WINDOW_SECONDS")?.trim();
  const parsed = raw ? Number(raw) : 3600;
  if (!Number.isFinite(parsed)) return 3600;
  return Math.max(60, Math.floor(parsed));
})();

const RATE_MAX = (() => {
  const raw = Deno.env.get("STAFF_APP_RATE_LIMIT_MAX")?.trim();
  const parsed = raw ? Number(raw) : 3;
  if (!Number.isFinite(parsed)) return 3;
  return Math.max(1, Math.floor(parsed));
})();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
};

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or API key (service role or anon).");
}

const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_KEY ?? "", {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

class HttpError extends Error {
  status: number;
  retryAfterSeconds?: number;

  constructor(message: string, status = 400, retryAfterSeconds?: number) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const json = (payload: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...(init?.headers ?? {}),
    },
  });

const getBearerToken = (req: Request) => {
  const header = req.headers.get("Authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header.split(" ")[1]?.trim() || null;
};

type ResolvedUser = { id: string; email: string | null };

const resolveUser = async (token: string | null): Promise<ResolvedUser> => {
  if (!token) throw new HttpError("Unauthorized", 401);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HttpError("Unauthorized", 401);
  return { id: data.user.id, email: data.user.email ?? null };
};

const isStaff = async (userId: string) => {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw new HttpError(error.message, 500);
  return !!data;
};

const fetchUsername = async (userId: string) => {
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  return (data?.username as string | null) ?? null;
};

const PositionSchema = z.enum(STAFF_APPLICATION_POSITIONS);

const AnswersSchema = z
  .object({
    minecraftUsername: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().min(1).max(32).optional(),
    ),
    age: z.number().int().min(13).max(99),
    discordTag: z.string().trim().min(2).max(64),
    timezone: z.string().trim().min(1).max(64),
    serverPlaytime: z.string().trim().min(1).max(280),
    availability: z.string().trim().min(1).max(500),
    experience: z.string().trim().min(1).max(2000),
    motivation: z.string().trim().min(1).max(2000),
    additionalInfo: z.string().trim().max(1200).optional(),
    rulesAccepted: z.boolean().refine((v) => v === true, { message: "You must accept the rules." }),
  })
  .passthrough();

const CreateSchema = z.object({
  position: PositionSchema,
  answers: AnswersSchema,
});

const EditSchema = z.object({
  position: PositionSchema,
  answers: AnswersSchema,
  changeReason: z.string().trim().max(140).optional(),
});

const sanitizeAnswers = (answers: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (typeof value === "string") out[key] = sanitizePlainText(value);
    else out[key] = value;
  }
  return out;
};

const enforceRateLimit = async (bucket: string) => {
  const { data, error } = await supabase.rpc("enforce_staff_app_rate_limit", {
    p_bucket: bucket,
    p_window_seconds: RATE_WINDOW_SECONDS,
    p_max_count: RATE_MAX,
  });

  if (error) {
    console.warn("Rate limit RPC failed:", error.message);
    return;
  }

  const retryAfterSeconds = typeof data === "number" ? data : Number(data);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    throw new HttpError("Too many submissions. Try again later.", 429, Math.max(1, Math.floor(retryAfterSeconds)));
  }
};

const logWebhookDelivery = async (payload: {
  applicationId: string;
  urlKey: string;
  responseCode: number;
  responseBody: string;
  success: boolean;
  body: Record<string, unknown>;
}) => {
  try {
    await supabase.from("webhook_deliveries").insert({
      staff_application_id: payload.applicationId,
      url: payload.urlKey,
      payload: payload.body,
      response_code: payload.responseCode,
      response_body: payload.responseBody,
      success: payload.success,
    });
  } catch (error) {
    console.error("Failed to log webhook delivery:", error);
  }
};

const sendDiscord = async (applicationId: string, body: Record<string, unknown>) => {
  if (!DISCORD_WEBHOOK_URL) return;
  const res = await postDiscordWebhookWithRetry(DISCORD_WEBHOOK_URL, body, { attempts: 3, baseDelayMs: 700 });
  await logWebhookDelivery({
    applicationId,
    urlKey: "DISCORD_WEBHOOK_URL",
    responseCode: res.status,
    responseBody: res.text,
    success: res.ok,
    body,
  });
};

const buildSnapshot = (row: StaffApplicationRow) => ({
  id: row.id,
  user_id: row.user_id,
  status: row.status,
  position: row.position,
  answers: safeRecord(row.answers),
  created_at: row.created_at,
  updated_at: row.updated_at,
  last_edited_at: row.last_edited_at,
  last_edited_by: row.last_edited_by,
  latest_revision_number: row.latest_revision_number,
  revision_count: row.revision_count,
});

const parseRoute = (req: Request, functionName: string) => {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const fnIndex = parts.indexOf(functionName);
  const routeParts = fnIndex >= 0 ? parts.slice(fnIndex + 1) : parts.slice(1);
  return { url, routeParts };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new HttpError("Server is missing Supabase configuration", 500);
    }

    const { routeParts } = parseRoute(req, "staff-applications");
    const token = getBearerToken(req);
    const user = await resolveUser(token);

    if (req.method === "GET" && routeParts.length === 1 && routeParts[0] === "mine") {
      const { data, error } = await supabase
        .from("staff_applications")
        .select(
          "id, user_id, status, position, answers, created_at, updated_at, last_edited_at, last_edited_by, latest_revision_number, revision_count",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw new HttpError(error.message, 500);
      return json({ applications: data ?? [] }, { status: 200 });
    }

    if (req.method === "GET" && routeParts.length === 1) {
      const applicationId = routeParts[0];
      if (!applicationId) throw new HttpError("Application id is required", 400);

      const { data: app, error: appError } = await supabase
        .from("staff_applications")
        .select("*")
        .eq("id", applicationId)
        .maybeSingle();
      if (appError) throw new HttpError(appError.message, 500);
      if (!app) throw new HttpError("Not found", 404);

      const ownerId = String((app as { user_id: unknown }).user_id ?? "");
      if (ownerId !== user.id && !(await isStaff(user.id))) {
        throw new HttpError("Forbidden", 403);
      }

      const { data: revisions, error: revError } = await supabase
        .from("staff_application_revisions")
        .select("id, revision_number, created_at, created_by, change_reason")
        .eq("application_id", applicationId)
        .order("revision_number", { ascending: false });
      if (revError) throw new HttpError(revError.message, 500);

      return json({ application: app, revisions: revisions ?? [] }, { status: 200 });
    }

    if (req.method === "POST" && routeParts.length === 0) {
      await enforceRateLimit(`staff_app:${user.id}`);
      const raw = await req.json();
      const parsed = CreateSchema.parse(raw);

      const nowIso = new Date().toISOString();
      const position = parsed.position as StaffApplicationPosition;
      const answers = sanitizeAnswers(parsed.answers);

      const { data: app, error: insertError } = await supabase
        .from("staff_applications")
        .insert({
          user_id: user.id,
          status: "pending",
          position,
          answers,
          last_edited_at: nowIso,
          last_edited_by: user.id,
          latest_revision_number: 1,
          revision_count: 1,
        })
        .select("*")
        .single();

      if (insertError || !app) {
        throw new HttpError(insertError?.message || "Unable to create application", 500);
      }

      const snapshot = buildSnapshot(app as unknown as StaffApplicationRow);
      const { error: revError } = await supabase.from("staff_application_revisions").insert({
        application_id: app.id,
        revision_number: 1,
        content_snapshot: snapshot,
        created_by: user.id,
      });
      if (revError) {
        throw new HttpError(revError.message, 500);
      }

      await supabase.from("activity_logs").insert({
        user_id: user.id,
        action: "staff_application_created",
        details: { application_id: app.id, position },
      });

      const username = await fetchUsername(user.id);
      const adminUrl = buildAdminApplicationUrl({
        adminBaseUrl: STAFF_APP_ADMIN_URL_BASE,
        origin: req.headers.get("Origin"),
        applicationId: app.id,
      });

      await sendDiscord(
        app.id,
        buildDiscordBodyNewStaffApplication({
          application: {
            id: app.id,
            user_id: user.id,
            status: "pending",
            position,
            created_at: app.created_at,
            answers,
          },
          username,
          editorId: user.id,
          editorUsername: username,
          adminUrl,
        }),
      );

      return json({ application: app }, { status: 200 });
    }

    if (req.method === "PUT" && routeParts.length === 1) {
      const applicationId = routeParts[0];
      if (!applicationId) throw new HttpError("Application id is required", 400);

      await enforceRateLimit(`staff_app:${user.id}`);

      const raw = await req.json();
      const parsed = EditSchema.parse(raw);
      const nowIso = new Date().toISOString();
      const position = parsed.position as StaffApplicationPosition;
      const answers = sanitizeAnswers(parsed.answers);
      const changeReason = parsed.changeReason ? sanitizePlainText(parsed.changeReason) : null;

      const { data: existing, error: existingError } = await supabase
        .from("staff_applications")
        .select("*")
        .eq("id", applicationId)
        .maybeSingle();

      if (existingError) throw new HttpError(existingError.message, 500);
      if (!existing) throw new HttpError("Not found", 404);
      if ((existing as { user_id: string }).user_id !== user.id) {
        throw new HttpError("Forbidden", 403);
      }

      const oldSnapshot = {
        status: String((existing as { status: unknown }).status ?? ""),
        position: String((existing as { position: unknown }).position ?? ""),
        answers: safeRecord((existing as { answers: unknown }).answers),
      };

      let updated: StaffApplicationRow | null = null;
      let revisionNumber = 0;
      let lastError: string | null = null;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { data: latestRev, error: latestRevError } = await supabase
          .from("staff_application_revisions")
          .select("revision_number")
          .eq("application_id", applicationId)
          .order("revision_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestRevError) throw new HttpError(latestRevError.message, 500);
        revisionNumber = (latestRev?.revision_number ?? 0) + 1;

        const { data: app, error: updateError } = await supabase
          .from("staff_applications")
          .update({
            status: "pending",
            position,
            answers,
            last_edited_at: nowIso,
            last_edited_by: user.id,
            latest_revision_number: revisionNumber,
            revision_count: revisionNumber,
          })
          .eq("id", applicationId)
          .select("*")
          .single();

        if (updateError || !app) throw new HttpError(updateError?.message || "Unable to update application", 500);

        const snapshot = buildSnapshot(app as unknown as StaffApplicationRow);
        const { error: revError } = await supabase.from("staff_application_revisions").insert({
          application_id: applicationId,
          revision_number: revisionNumber,
          content_snapshot: snapshot,
          created_by: user.id,
          change_reason: changeReason,
        });

        if (!revError) {
          updated = app as unknown as StaffApplicationRow;
          break;
        }

        lastError = revError.message;
        // Retry on unique violations (race/double-submit).
        if (revError.code === "23505") continue;
        throw new HttpError(revError.message, 500);
      }

      if (!updated) {
        throw new HttpError(lastError || "Unable to create a new revision", 500);
      }

      await supabase.from("activity_logs").insert({
        user_id: user.id,
        action: "staff_application_edited",
        details: { application_id: applicationId, revision_number: revisionNumber },
      });

      const username = await fetchUsername(user.id);
      const adminUrl = buildAdminApplicationUrl({
        adminBaseUrl: STAFF_APP_ADMIN_URL_BASE,
        origin: req.headers.get("Origin"),
        applicationId,
      });

      await sendDiscord(
        applicationId,
        buildDiscordBodyEditedStaffApplication({
          application: {
            id: updated.id,
            user_id: updated.user_id,
            status: "pending",
            position,
            updated_at: updated.updated_at,
            answers,
          },
          username,
          oldSnapshot,
          editorId: user.id,
          editorUsername: username,
          editedAtIso: nowIso,
          adminUrl,
        }),
      );

      return json({ application: updated }, { status: 200 });
    }

    throw new HttpError("Not found", 404);
  } catch (error) {
    console.error("staff-applications failed:", error);
    const message = error instanceof HttpError ? error.message : "Unexpected error";
    const status = error instanceof HttpError ? error.status : 500;
    const retry = error instanceof HttpError ? error.retryAfterSeconds : undefined;
    return json(
      { error: message, ...(retry ? { retryAfterSeconds: retry } : {}) },
      {
        status,
        headers: retry ? { "Retry-After": String(retry) } : undefined,
      },
    );
  }
});
