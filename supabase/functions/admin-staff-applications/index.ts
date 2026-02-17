import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.1";
import { z } from "https://esm.sh/zod@3.25.76";

import {
  STAFF_APPLICATION_POSITIONS,
  STAFF_APPLICATION_STATUSES,
  buildAdminApplicationUrl,
  buildDiscordBodyEditedStaffApplication,
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
};

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or API key (service role or anon).");
}

const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
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

const resolveUserId = async (token: string | null) => {
  if (!token) throw new HttpError("Unauthorized", 401);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HttpError("Unauthorized", 401);
  return data.user.id;
};

const assertAdmin = async (userId: string) => {
  const { data, error } = await supabase.rpc("is_admin", { _user_id: userId });
  if (error) throw new HttpError(error.message, 500);
  if (!data) throw new HttpError("Forbidden", 403);
};

const fetchProfilesByIds = async (ids: string[]) => {
  if (ids.length === 0) return new Map<string, { username: string | null; avatar_url: string | null }>();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", Array.from(new Set(ids)));
  if (error) throw new HttpError(error.message, 500);

  return new Map(
    (data ?? []).map((p) => [
      String((p as { id: unknown }).id),
      {
        username: (p as { username: unknown }).username as string | null,
        avatar_url: (p as { avatar_url: unknown }).avatar_url as string | null,
      },
    ]),
  );
};

const sanitizeAnswers = (answers: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (typeof value === "string") out[key] = sanitizePlainText(value);
    else out[key] = value;
  }
  return out;
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

const PositionSchema = z.enum(STAFF_APPLICATION_POSITIONS);
const StatusSchema = z.enum(STAFF_APPLICATION_STATUSES);

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

const AdminEditSchema = z.object({
  position: PositionSchema,
  answers: AnswersSchema,
  changeReason: z.string().trim().max(140).optional(),
});

const StatusUpdateSchema = z.object({
  status: StatusSchema,
});

const NoteSchema = z.object({
  note: z.string().trim().min(1).max(2000),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new HttpError("Server is missing Supabase configuration", 500);
    }

    const { url, routeParts } = parseRoute(req, "admin-staff-applications");
    const userId = await resolveUserId(getBearerToken(req));
    await assertAdmin(userId);

    // GET /
    if (req.method === "GET" && routeParts.length === 0) {
      const status = url.searchParams.get("status");
      const position = url.searchParams.get("position");
      const q = url.searchParams.get("q")?.trim() || "";
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));
      const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);

      let appQuery = supabase
        .from("staff_applications")
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (status && STAFF_APPLICATION_STATUSES.includes(status as never)) {
        appQuery = appQuery.eq("status", status);
      }
      if (position && STAFF_APPLICATION_POSITIONS.includes(position as never)) {
        appQuery = appQuery.eq("position", position);
      }
      if (from) appQuery = appQuery.gte("created_at", from);
      if (to) appQuery = appQuery.lte("created_at", to);

      if (q) {
        const uuidish = /^[0-9a-fA-F-]{8,}$/.test(q);
        if (uuidish && q.length >= 32) {
          appQuery = appQuery.or(`id.eq.${q},user_id.eq.${q}`);
        } else {
          const { data: matches, error: matchError } = await supabase
            .from("profiles")
            .select("id")
            .ilike("username", `%${q}%`)
            .limit(50);
          if (matchError) throw new HttpError(matchError.message, 500);
          const ids = (matches ?? []).map((m) => String((m as { id: unknown }).id)).filter(Boolean);
          if (ids.length === 0) {
            return json({ applications: [], total: 0 }, { status: 200 });
          }
          appQuery = appQuery.in("user_id", ids);
        }
      }

      const { data: apps, error } = await appQuery;
      if (error) throw new HttpError(error.message, 500);

      const rows = (apps ?? []) as unknown as StaffApplicationRow[];
      const profiles = await fetchProfilesByIds(rows.map((r) => r.user_id));

      return json(
        {
          applications: rows.map((r) => ({
            ...r,
            user: { id: r.user_id, ...(profiles.get(r.user_id) ?? { username: null, avatar_url: null }) },
          })),
        },
        { status: 200 },
      );
    }

    // GET /:id or /:id/revisions...
    if (routeParts.length >= 1) {
      const applicationId = routeParts[0];
      if (!applicationId) throw new HttpError("Application id is required", 400);

      if (req.method === "GET" && routeParts.length === 1) {
        const { data: app, error: appError } = await supabase
          .from("staff_applications")
          .select("*")
          .eq("id", applicationId)
          .maybeSingle();
        if (appError) throw new HttpError(appError.message, 500);
        if (!app) throw new HttpError("Not found", 404);

        const { data: revisions, error: revError } = await supabase
          .from("staff_application_revisions")
          .select("id, revision_number, created_at, created_by, change_reason")
          .eq("application_id", applicationId)
          .order("revision_number", { ascending: false });
        if (revError) throw new HttpError(revError.message, 500);

        const { data: notes, error: notesError } = await supabase
          .from("staff_application_admin_notes")
          .select("id, application_id, admin_id, note, created_at")
          .eq("application_id", applicationId)
          .order("created_at", { ascending: false });
        if (notesError) throw new HttpError(notesError.message, 500);

        const profileIds = [
          String((app as { user_id: unknown }).user_id),
          ...((revisions ?? []).map((r) => String((r as { created_by: unknown }).created_by)).filter(Boolean)),
          ...((notes ?? []).map((n) => String((n as { admin_id: unknown }).admin_id)).filter(Boolean)),
        ].filter(Boolean);

        const profiles = await fetchProfilesByIds(profileIds);

        const revisionsWithUsers = (revisions ?? []).map((r) => {
          const createdBy = (r as { created_by: string | null }).created_by;
          return {
            ...r,
            created_by_user: createdBy ? { id: createdBy, ...(profiles.get(createdBy) ?? {}) } : null,
          };
        });

        return json(
          {
            application: app,
            user: { id: (app as { user_id: string }).user_id, ...(profiles.get((app as { user_id: string }).user_id) ?? {}) },
            revisions: revisionsWithUsers,
            notes: (notes ?? []).map((n) => ({
              ...n,
              admin: (n as { admin_id: string | null }).admin_id
                ? { id: (n as { admin_id: string }).admin_id, ...(profiles.get((n as { admin_id: string }).admin_id) ?? {}) }
                : null,
            })),
          },
          { status: 200 },
        );
      }

      if (req.method === "GET" && routeParts.length === 2 && routeParts[1] === "revisions") {
        const { data: revisions, error: revError } = await supabase
          .from("staff_application_revisions")
          .select("id, revision_number, created_at, created_by, change_reason")
          .eq("application_id", applicationId)
          .order("revision_number", { ascending: false });
        if (revError) throw new HttpError(revError.message, 500);
        return json({ revisions: revisions ?? [] }, { status: 200 });
      }

      if (req.method === "GET" && routeParts.length === 3 && routeParts[1] === "revisions") {
        const revId = routeParts[2];
        const { data: revision, error } = await supabase
          .from("staff_application_revisions")
          .select("*")
          .eq("id", revId)
          .maybeSingle();
        if (error) throw new HttpError(error.message, 500);
        if (!revision || (revision as { application_id: string }).application_id !== applicationId) {
          throw new HttpError("Not found", 404);
        }
        return json({ revision }, { status: 200 });
      }

      if (req.method === "PATCH" && routeParts.length === 2 && routeParts[1] === "status") {
        const parsed = StatusUpdateSchema.parse(await req.json());

        const { data: existing, error: existingError } = await supabase
          .from("staff_applications")
          .select("id, status")
          .eq("id", applicationId)
          .maybeSingle();
        if (existingError) throw new HttpError(existingError.message, 500);
        if (!existing) throw new HttpError("Not found", 404);

        const oldStatus = String((existing as { status: unknown }).status ?? "");
        const { data: updated, error: updateError } = await supabase
          .from("staff_applications")
          .update({ status: parsed.status })
          .eq("id", applicationId)
          .select("*")
          .single();
        if (updateError || !updated) throw new HttpError(updateError?.message || "Unable to update status", 500);

        await supabase.from("activity_logs").insert({
          user_id: userId,
          action: "staff_application_status_updated",
          details: { application_id: applicationId, old_status: oldStatus, new_status: parsed.status },
        });

        return json({ application: updated }, { status: 200 });
      }

      if (req.method === "POST" && routeParts.length === 2 && routeParts[1] === "notes") {
        const parsed = NoteSchema.parse(await req.json());
        const note = sanitizePlainText(parsed.note);

        const { data: created, error } = await supabase
          .from("staff_application_admin_notes")
          .insert({ application_id: applicationId, admin_id: userId, note })
          .select("*")
          .single();
        if (error || !created) throw new HttpError(error?.message || "Unable to create note", 500);

        await supabase.from("activity_logs").insert({
          user_id: userId,
          action: "staff_application_note_added",
          details: { application_id: applicationId, note_id: (created as { id: string }).id },
        });

        return json({ note: created }, { status: 200 });
      }

      if (req.method === "PUT" && routeParts.length === 1) {
        const raw = await req.json();
        const parsed = AdminEditSchema.parse(raw);

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
              last_edited_by: userId,
              latest_revision_number: revisionNumber,
              revision_count: revisionNumber,
            })
            .eq("id", applicationId)
            .select("*")
            .single();
          if (updateError || !app) throw new HttpError(updateError?.message || "Unable to edit application", 500);

          const snapshot = buildSnapshot(app as unknown as StaffApplicationRow);
          const { error: revError } = await supabase.from("staff_application_revisions").insert({
            application_id: applicationId,
            revision_number: revisionNumber,
            content_snapshot: snapshot,
            created_by: userId,
            change_reason: changeReason,
          });

          if (!revError) {
            updated = app as unknown as StaffApplicationRow;
            break;
          }

          lastError = revError.message;
          if (revError.code === "23505") continue;
          throw new HttpError(revError.message, 500);
        }

        if (!updated) throw new HttpError(lastError || "Unable to create a new revision", 500);

        await supabase.from("activity_logs").insert({
          user_id: userId,
          action: "staff_application_admin_edited",
          details: { application_id: applicationId, revision_number: revisionNumber },
        });

        const profiles = await fetchProfilesByIds([updated.user_id, userId]);
        const username = profiles.get(updated.user_id)?.username ?? null;
        const editorUsername = profiles.get(userId)?.username ?? null;

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
            editorId: userId,
            editorUsername,
            editedAtIso: nowIso,
            adminUrl,
          }),
        );

        return json({ application: updated }, { status: 200 });
      }
    }

    throw new HttpError("Not found", 404);
  } catch (error) {
    console.error("admin-staff-applications failed:", error);
    const message = error instanceof HttpError ? error.message : "Unexpected error";
    const status = error instanceof HttpError ? error.status : 500;
    return json({ error: message }, { status });
  }
});
