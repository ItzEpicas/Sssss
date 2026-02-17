import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Pencil, RefreshCcw } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import StaffApplicationEditorDialog from "@/components/profile/StaffApplicationEditorDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction } from "@/lib/supabaseEdge";
import { staffApplicationEditSchema, type StaffApplicationEditFormInput } from "@/lib/staff-applications/schema";
import type {
  StaffApplication,
  StaffApplicationAnswers,
  StaffApplicationAdminNote,
  StaffApplicationRevision,
  StaffApplicationStatus,
} from "@/lib/staff-applications/types";
import { formatStaffAppDate, positionLabels, statusBadgeClass, statusLabels } from "@/lib/staff-applications/ui";

type DetailResponse = {
  application: StaffApplication;
  user: { id: string; username: string | null; avatar_url: string | null };
  revisions: Array<
    StaffApplicationRevision & {
      created_by_user: { id: string; username: string | null; avatar_url: string | null } | null;
    }
  >;
  notes: Array<
    StaffApplicationAdminNote & {
      admin: { id: string; username: string | null; avatar_url: string | null } | null;
    }
  >;
};

type RevisionResponse = { revision: StaffApplicationRevision & { content_snapshot: unknown } };

const formatValue = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const diffAnswers = (oldAnswers: Record<string, unknown>, newAnswers: Record<string, unknown>) => {
  const keys = new Set<string>([...Object.keys(oldAnswers), ...Object.keys(newAnswers)]);
  const out: Array<{ key: string; oldValue: string; newValue: string }> = [];
  for (const key of Array.from(keys).sort()) {
    const oldVal = oldAnswers[key];
    const newVal = newAnswers[key];
    const oldStr = formatValue(oldVal);
    const newStr = formatValue(newVal);
    if (oldStr !== newStr) {
      out.push({ key, oldValue: oldStr, newValue: newStr });
    }
  }
  return out;
};

const extractAnswersFromSnapshot = (snapshot: unknown): Record<string, unknown> => {
  if (!snapshot || typeof snapshot !== "object") return {};
  const maybe = snapshot as { answers?: unknown };
  if (!maybe.answers || typeof maybe.answers !== "object" || Array.isArray(maybe.answers)) return {};
  return maybe.answers as Record<string, unknown>;
};

const StaffApplicationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [note, setNote] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDefaults, setEditorDefaults] = useState<StaffApplicationEditFormInput | null>(null);

  const [oldRevId, setOldRevId] = useState<string | null>(null);
  const [newRevId, setNewRevId] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["admin-staff-application", id],
    enabled: !!id,
    queryFn: async () => callEdgeFunction<DetailResponse>(`admin-staff-applications/${id}`),
  });

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`admin-staff-application-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_applications", filter: `id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-staff-application", id] });
        queryClient.invalidateQueries({ queryKey: ["admin-staff-application-revision", id] });
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_application_revisions", filter: `application_id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-staff-application", id] });
          queryClient.invalidateQueries({ queryKey: ["admin-staff-application-revision", id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_application_admin_notes", filter: `application_id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-staff-application", id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  useEffect(() => {
    const revisions = detailQuery.data?.revisions ?? [];
    if (!revisions.length) return;

    if (!newRevId) setNewRevId(revisions[0].id);
    if (!oldRevId) setOldRevId(revisions[1]?.id ?? revisions[0].id);
  }, [detailQuery.data?.revisions, newRevId, oldRevId]);

  const oldRevQuery = useQuery({
    queryKey: ["admin-staff-application-revision", id, oldRevId],
    enabled: !!id && !!oldRevId,
    queryFn: async () => callEdgeFunction<RevisionResponse>(`admin-staff-applications/${id}/revisions/${oldRevId}`),
  });

  const newRevQuery = useQuery({
    queryKey: ["admin-staff-application-revision", id, newRevId],
    enabled: !!id && !!newRevId,
    queryFn: async () => callEdgeFunction<RevisionResponse>(`admin-staff-applications/${id}/revisions/${newRevId}`),
  });

  const statusMutation = useMutation({
    mutationFn: async (status: StaffApplicationStatus) =>
      callEdgeFunction<{ application: StaffApplication }>(`admin-staff-applications/${id}/status`, {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-staff-application", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-staff-applications"] });
      toast({ title: "Status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not update status", description: error.message, variant: "destructive" });
    },
  });

  const noteMutation = useMutation({
    mutationFn: async (text: string) =>
      callEdgeFunction<{ note: StaffApplicationAdminNote }>(`admin-staff-applications/${id}/notes`, {
        method: "POST",
        body: { note: text },
      }),
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["admin-staff-application", id] });
      toast({ title: "Note added" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not add note", description: error.message, variant: "destructive" });
    },
  });

  const adminEditMutation = useMutation({
    mutationFn: async (input: StaffApplicationEditFormInput) => {
      const parsed = staffApplicationEditSchema.parse(input);
      return callEdgeFunction<{ application: StaffApplication }>(`admin-staff-applications/${id}`, {
        method: "PUT",
        body: parsed,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-staff-application", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-staff-applications"] });
      toast({ title: "Application edited", description: "A new revision was created." });
    },
    onError: (error: Error) => {
      toast({ title: "Could not edit", description: error.message, variant: "destructive" });
    },
  });

  const application = detailQuery.data?.application ?? null;
  const user = detailQuery.data?.user ?? null;
  const revisions = detailQuery.data?.revisions ?? [];
  const notes = detailQuery.data?.notes ?? [];

  const latestRevision = revisions[0] ?? null;
  const latestEditorLabel =
    latestRevision?.created_by_user?.username ??
    latestRevision?.created_by ??
    application?.last_edited_by ??
    "—";

  const diff = useMemo(() => {
    const oldSnap = oldRevQuery.data?.revision?.content_snapshot ?? null;
    const newSnap = newRevQuery.data?.revision?.content_snapshot ?? null;
    return diffAnswers(extractAnswersFromSnapshot(oldSnap), extractAnswersFromSnapshot(newSnap));
  }, [newRevQuery.data?.revision?.content_snapshot, oldRevQuery.data?.revision?.content_snapshot]);

  const openEditor = () => {
    if (!application) return;
    const answers = application.answers as StaffApplicationAnswers;
    setEditorDefaults({
      position: application.position,
      answers: {
        minecraftUsername: answers.minecraftUsername ?? "",
        age: typeof answers.age === "number" ? answers.age : Number(answers.age ?? ""),
        discordTag: answers.discordTag ?? "",
        timezone: answers.timezone ?? "",
        serverPlaytime: answers.serverPlaytime ?? "",
        availability: answers.availability ?? "",
        experience: answers.experience ?? "",
        motivation: answers.motivation ?? "",
        additionalInfo: answers.additionalInfo ?? "",
        rulesAccepted:
          typeof answers.rulesAccepted === "boolean" ? answers.rulesAccepted : String(answers.rulesAccepted).toLowerCase() === "true",
      },
      changeReason: "",
    });
    setEditorOpen(true);
  };

  if (!id) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Missing application id.</p>
        <Button variant="outline" onClick={() => navigate("/admin/staff-applications")}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/staff-applications">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold">Application</h1>
            <p className="text-sm text-muted-foreground font-mono">{id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-staff-application", id] })}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={openEditor} disabled={!application}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      {detailQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : detailQuery.isError ? (
        <div className="rounded-xl border border-border/40 p-6 text-sm text-red-500">
          {(detailQuery.error as Error).message}
        </div>
      ) : application && user ? (
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-6">
            <Card className="glass-card border-border/30">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11">
                      <AvatarImage src={user.avatar_url ?? undefined} />
                      <AvatarFallback>{(user.username ?? user.id).slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-xl">{user.username ?? "Unknown user"}</CardTitle>
                      <CardDescription className="font-mono text-xs">{user.id}</CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={statusBadgeClass[application.status]}>{statusLabels[application.status]}</Badge>
                    <Badge variant="outline">{positionLabels[application.position]}</Badge>
                    {(application.revision_count ?? 1) > 1 ? <Badge variant="outline">Edited</Badge> : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Created</p>
                    <p className="text-sm">{formatStaffAppDate(application.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Last edited</p>
                    <p className="text-sm">
                      {formatStaffAppDate(application.last_edited_at)} <span className="text-muted-foreground">by</span>{" "}
                      {latestEditorLabel}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => statusMutation.mutate("accepted")}
                    disabled={statusMutation.isPending}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => statusMutation.mutate("denied")}
                    disabled={statusMutation.isPending}
                  >
                    Deny
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => statusMutation.mutate("need_more_info")}
                    disabled={statusMutation.isPending}
                  >
                    Need more info
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => statusMutation.mutate("pending")}
                    disabled={statusMutation.isPending}
                  >
                    Set pending
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-border/30">
              <CardHeader className="pb-4">
                <CardTitle>Current Answers</CardTitle>
                <CardDescription>Latest submitted answers (current application state).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <pre className="whitespace-pre-wrap rounded-xl border border-border/40 bg-muted/20 p-4 text-sm">
                  {JSON.stringify(application.answers, null, 2)}
                </pre>
              </CardContent>
            </Card>

            <Card className="glass-card border-border/30">
              <CardHeader className="pb-4">
                <CardTitle>Diff Viewer</CardTitle>
                <CardDescription>Compare two revisions (old vs new).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select value={oldRevId ?? ""} onValueChange={(v) => setOldRevId(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Old revision" />
                    </SelectTrigger>
                    <SelectContent>
                      {revisions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          #{r.revision_number} — {formatStaffAppDate(r.created_at)}{" "}
                          {r.created_by_user?.username ? `(${r.created_by_user.username})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={newRevId ?? ""} onValueChange={(v) => setNewRevId(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="New revision" />
                    </SelectTrigger>
                    <SelectContent>
                      {revisions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          #{r.revision_number} — {formatStaffAppDate(r.created_at)}{" "}
                          {r.created_by_user?.username ? `(${r.created_by_user.username})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {oldRevQuery.isLoading || newRevQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading revisions...
                  </div>
                ) : oldRevQuery.isError || newRevQuery.isError ? (
                  <div className="text-sm text-red-500">
                    {(oldRevQuery.error as Error)?.message || (newRevQuery.error as Error)?.message}
                  </div>
                ) : (
                  <div className="rounded-lg border border-border/40">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Field</TableHead>
                          <TableHead>Old</TableHead>
                          <TableHead>New</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {diff.map((row) => (
                          <TableRow key={row.key}>
                            <TableCell className="font-medium">{row.key}</TableCell>
                            <TableCell className="align-top">
                              <pre className="whitespace-pre-wrap text-xs">{row.oldValue || "—"}</pre>
                            </TableCell>
                            <TableCell className="align-top">
                              <pre className="whitespace-pre-wrap text-xs">{row.newValue || "—"}</pre>
                            </TableCell>
                          </TableRow>
                        ))}
                        {diff.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                              No differences between the selected revisions.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="glass-card border-border/30">
              <CardHeader className="pb-4">
                <CardTitle>Revisions</CardTitle>
                <CardDescription>Append-only version history.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revisions.map((rev) => (
                      <TableRow key={rev.id}>
                        <TableCell className="font-medium">#{rev.revision_number}</TableCell>
                        <TableCell className="text-muted-foreground">{formatStaffAppDate(rev.created_at)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {rev.created_by_user?.username ?? rev.created_by ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{rev.change_reason || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {revisions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          No revisions yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="glass-card border-border/30">
              <CardHeader className="pb-4">
                <CardTitle>Internal Notes</CardTitle>
                <CardDescription>Visible to staff only.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Write an internal note for this application..."
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => noteMutation.mutate(note)}
                    disabled={noteMutation.isPending || note.trim().length === 0}
                  >
                    {noteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Add note
                  </Button>
                </div>

                <div className="space-y-3">
                  {notes.map((n) => (
                    <div key={n.id} className="rounded-xl border border-border/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {n.admin?.username ?? n.admin_id ?? "Staff"}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatStaffAppDate(n.created_at)}</p>
                        </div>
                      </div>
                      <pre className="mt-3 whitespace-pre-wrap text-sm">{n.note}</pre>
                    </div>
                  ))}
                  {notes.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No notes yet.</div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/40 p-6 text-sm text-muted-foreground">Not found.</div>
      )}

      {editorDefaults ? (
        <StaffApplicationEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          title="Edit Application (Admin)"
          description='Editing creates a new revision and sends an "Application Edited" webhook.'
          mode="edit"
          defaultValues={editorDefaults}
          submitting={adminEditMutation.isPending}
          onSubmit={async (values) => {
            await adminEditMutation.mutateAsync(values);
            setEditorOpen(false);
          }}
        />
      ) : null}
    </div>
  );
};

export default StaffApplicationDetail;
