import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction, EdgeFunctionError } from "@/lib/supabaseEdge";
import {
  staffApplicationCreateSchema,
  staffApplicationEditSchema,
  type StaffApplicationEditFormInput,
} from "@/lib/staff-applications/schema";
import type {
  StaffApplication,
  StaffApplicationAnswers,
  StaffApplicationRevision,
} from "@/lib/staff-applications/types";
import {
  formatStaffAppDate,
  getPositionLabel,
  getStatusLabel,
  statusBadgeClass,
} from "@/lib/staff-applications/ui";
import StaffApplicationEditorDialog from "./StaffApplicationEditorDialog";

type Props = {
  defaultAnswers?: Partial<StaffApplicationAnswers>;
};

const emptyForm = (defaults?: Partial<StaffApplicationAnswers>): StaffApplicationEditFormInput => ({
  position: "helper",
  answers: {
    age: undefined,
    discordTag: defaults?.discordTag ?? "",
    timezone: defaults?.timezone ?? "",
    serverPlaytime: defaults?.serverPlaytime ?? "",
    availability: "",
    experience: "",
    motivation: "",
    minecraftUsername: defaults?.minecraftUsername ?? "",
    additionalInfo: "",
    rulesAccepted: defaults?.rulesAccepted ?? false,
  },
  changeReason: "",
});

const renderAnswers = (answers: StaffApplicationAnswers, language: "en" | "ka") => {
  const isKa = language === "ka";
  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: isKa ? "Minecraft" : "Minecraft", value: answers.minecraftUsername || "—" },
    { label: isKa ? "ასაკი" : "Age", value: typeof answers.age === "number" ? String(answers.age) : "—" },
    { label: "Discord", value: answers.discordTag || "—" },
    { label: isKa ? "დროის ზონა" : "Timezone", value: answers.timezone || "—" },
    {
      label: isKa ? "სერვერზე რამდენი ხანია თამაშობ?" : "Server playtime",
      value: <pre className="whitespace-pre-wrap text-sm">{answers.serverPlaytime || "—"}</pre>,
    },
    {
      label: isKa ? "ხელმისაწვდომობა" : "Availability",
      value: <pre className="whitespace-pre-wrap text-sm">{answers.availability || "—"}</pre>,
    },
    {
      label: isKa ? "გამოცდილება" : "Experience",
      value: <pre className="whitespace-pre-wrap text-sm">{answers.experience || "—"}</pre>,
    },
    {
      label: isKa ? "მოტივაცია" : "Motivation",
      value: <pre className="whitespace-pre-wrap text-sm">{answers.motivation || "—"}</pre>,
    },
    {
      label: isKa ? "დამატებითი ინფორმაცია" : "Additional info",
      value: <pre className="whitespace-pre-wrap text-sm">{answers.additionalInfo || "—"}</pre>,
    },
    {
      label: isKa ? "წესები" : "Rules",
      value:
        typeof answers.rulesAccepted === "boolean"
          ? answers.rulesAccepted
            ? isKa
              ? "დადასტურებულია"
              : "Accepted"
            : isKa
              ? "არ არის დადასტურებული"
              : "Not accepted"
          : "—",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{row.label}</p>
          <div className="text-sm">{row.value}</div>
        </div>
      ))}
    </div>
  );
};

const StaffAppTab: React.FC<Props> = ({ defaultAnswers }) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isKa = language === "ka";

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editorDefaults, setEditorDefaults] = useState<StaffApplicationEditFormInput>(emptyForm(defaultAnswers));

  const [viewOpen, setViewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const mineQuery = useQuery({
    queryKey: ["staff-applications", "mine", user?.id],
    enabled: !!user,
    queryFn: async () =>
      callEdgeFunction<{ applications: StaffApplication[] }>("staff-applications/mine", { method: "GET" }),
  });

  const detailQuery = useQuery({
    queryKey: ["staff-applications", "detail", selectedId],
    enabled: !!user && !!selectedId && viewOpen,
    queryFn: async () =>
      callEdgeFunction<{ application: StaffApplication; revisions: StaffApplicationRevision[] }>(
        `staff-applications/${selectedId}`,
        { method: "GET" },
      ),
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`staff-applications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_applications", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["staff-applications", "mine", user.id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user]);

  const createMutation = useMutation({
    mutationFn: async (input: StaffApplicationEditFormInput) => {
      const parsed = staffApplicationCreateSchema.parse(input);
      return callEdgeFunction<{ application: StaffApplication }>("staff-applications", { method: "POST", body: parsed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-applications", "mine", user?.id] });
      toast({
        title: isKa ? "განაცხადი გაიგზავნა" : "Application submitted",
        description: isKa ? "თქვენი განაცხადი გადაცემულია განხილვაზე." : "Your staff application is now pending review.",
      });
    },
    onError: (error: Error) => {
      const retry =
        error instanceof EdgeFunctionError && error.retryAfterSeconds
          ? ` Try again in ${error.retryAfterSeconds}s.`
          : "";
      toast({
        title: isKa ? "ვერ გაიგზავნა" : "Could not submit",
        description: `${error.message}${retry}`,
        variant: "destructive",
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (payload: { id: string; input: StaffApplicationEditFormInput }) => {
      const parsed = staffApplicationEditSchema.parse(payload.input);
      return callEdgeFunction<{ application: StaffApplication }>(`staff-applications/${payload.id}`, {
        method: "PUT",
        body: parsed,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-applications", "mine", user?.id] });
      if (selectedId) queryClient.invalidateQueries({ queryKey: ["staff-applications", "detail", selectedId] });
      toast({
        title: isKa ? "განაცხადი განახლდა" : "Application updated",
        description: isKa
          ? "ცვლილებები გაიგზავნა და სტატუსი გახდა „მოლოდინში“."
          : "Your changes were submitted and marked as pending.",
      });
    },
    onError: (error: Error) => {
      const retry =
        error instanceof EdgeFunctionError && error.retryAfterSeconds
          ? ` Try again in ${error.retryAfterSeconds}s.`
          : "";
      toast({
        title: isKa ? "ვერ განახლდა" : "Could not update",
        description: `${error.message}${retry}`,
        variant: "destructive",
      });
    },
  });

  const applications = useMemo(() => mineQuery.data?.applications ?? [], [mineQuery.data?.applications]);

  const openCreate = () => {
    setEditorMode("create");
    setEditorDefaults(emptyForm(defaultAnswers));
    setEditorOpen(true);
  };

  const openEdit = (app: StaffApplication) => {
    const answers = app.answers as StaffApplicationAnswers;
    setEditorMode("edit");
    setEditorDefaults({
      position: app.position,
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
    setSelectedId(app.id);
    setEditorOpen(true);
  };

  const openView = (appId: string) => {
    setSelectedId(appId);
    setViewOpen(true);
  };

  const handleEditorSubmit = async (values: StaffApplicationEditFormInput) => {
    if (editorMode === "create") {
      await createMutation.mutateAsync(values);
      setEditorOpen(false);
      return;
    }

    if (!selectedId) {
      toast({ title: isKa ? "აირჩიეთ განაცხადი" : "No application selected", variant: "destructive" });
      return;
    }

    await editMutation.mutateAsync({ id: selectedId, input: values });
    setEditorOpen(false);
  };

  const selectedApplication = useMemo(() => {
    if (detailQuery.data?.application) return detailQuery.data.application;
    if (!selectedId) return null;
    return applications.find((a) => a.id === selectedId) ?? null;
  }, [applications, detailQuery.data?.application, selectedId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">{isKa ? "სტაფის განაცხადები" : "Staff Applications"}</h2>
          <p className="text-muted-foreground">
            {isKa ? "გააგზავნეთ ახალი განაცხადი და მართეთ წინა განაცხადები." : "Submit new applications and manage your past submissions."}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {isKa ? "ახალი განაცხადი" : "Create New Application"}
        </Button>
      </div>

      <Card className="glass-card border-border/30">
        <CardHeader className="pb-4">
          <CardTitle>{isKa ? "თქვენი განაცხადები" : "Your Applications"}</CardTitle>
          <CardDescription>
            {isKa ? "ყველა განაცხადი, რომელიც ოდესმე გაგიგზავნიათ." : "All staff applications you've submitted so far."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {mineQuery.isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          ) : mineQuery.isError ? (
            <div className="p-6 text-sm text-red-500">{(mineQuery.error as Error).message}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isKa ? "პოზიცია" : "Position"}</TableHead>
                  <TableHead>{isKa ? "სტატუსი" : "Status"}</TableHead>
                  <TableHead>{isKa ? "შექმნილია" : "Created"}</TableHead>
                  <TableHead>{isKa ? "ბოლო ცვლილება" : "Last Edited"}</TableHead>
                  <TableHead>{isKa ? "ვერსიები" : "Revisions"}</TableHead>
                  <TableHead className="text-right">{isKa ? "ქმედება" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => {
                  const edited = (app.revision_count ?? 1) > 1;
                  return (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">{getPositionLabel(app.position, language)}</TableCell>
                      <TableCell>
                        <Badge className={statusBadgeClass[app.status]}>{getStatusLabel(app.status, language)}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatStaffAppDate(app.created_at)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatStaffAppDate(app.last_edited_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{app.revision_count ?? 1}</span>
                          {edited ? <Badge variant="outline">{isKa ? "რედაქტირებულია" : "Edited"}</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openView(app.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            {isKa ? "ნახვა" : "View"}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEdit(app)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {isKa ? "რედაქტირება" : "Edit"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {applications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      {isKa ? "ჯერ განაცხადები არ გაქვთ. დაიწყეთ ახლის შექმნით." : "No applications yet. Create one to get started."}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <StaffApplicationEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        title={editorMode === "create" ? (isKa ? "სტაფის განაცხადი" : "Create Staff Application") : isKa ? "რედაქტირება" : "Edit Staff Application"}
        description={
          editorMode === "create"
            ? isKa
              ? "შეავსეთ ფორმა და გაგზავნეთ განაცხადი."
              : "Fill out the form and submit your application."
            : isKa
              ? "განაახლეთ პასუხები და ხელახლა გაგზავნეთ. სტატუსი გახდება „მოლოდინში“."
              : "Update your answers and resubmit. Your status will be set to Pending."
        }
        mode={editorMode}
        defaultValues={editorDefaults}
        submitting={createMutation.isPending || editMutation.isPending}
        onSubmit={handleEditorSubmit}
      />

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{isKa ? "განაცხადის დეტალები" : "Application Details"}</DialogTitle>
            <DialogDescription>
              {isKa ? "იხილეთ მიმდინარე ვერსია და ცვლილებების ისტორია." : "Review the current version and revision history."}
            </DialogDescription>
          </DialogHeader>

          {detailQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : detailQuery.isError ? (
            <div className="text-sm text-red-500">{(detailQuery.error as Error).message}</div>
          ) : selectedApplication ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={statusBadgeClass[selectedApplication.status]}>
                      {getStatusLabel(selectedApplication.status, language)}
                    </Badge>
                    <Badge variant="outline">{getPositionLabel(selectedApplication.position, language)}</Badge>
                    {(selectedApplication.revision_count ?? 1) > 1 ? (
                      <Badge variant="outline">{isKa ? "რედაქტირებულია" : "Edited"}</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">ID: {selectedApplication.id}</p>
                  <p className="text-sm text-muted-foreground">
                    {isKa ? "შექმნილია" : "Created"} {formatStaffAppDate(selectedApplication.created_at)} •{" "}
                    {isKa ? "ბოლო ცვლილება" : "Last edited"} {formatStaffAppDate(selectedApplication.last_edited_at)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewOpen(false);
                    openEdit(selectedApplication);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {isKa ? "რედაქტირება და გაგზავნა" : "Edit & Resubmit"}
                </Button>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{isKa ? "მიმდინარე პასუხები" : "Current Answers"}</h3>
                {renderAnswers(selectedApplication.answers as StaffApplicationAnswers, language)}
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold">{isKa ? "ვერსიების ისტორია" : "Revision History"}</h3>
                <div className="rounded-lg border border-border/40">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isKa ? "ვერსია" : "Revision"}</TableHead>
                        <TableHead>{isKa ? "თარიღი" : "Created"}</TableHead>
                        <TableHead>{isKa ? "მიზეზი" : "Reason"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detailQuery.data?.revisions ?? []).map((rev) => (
                        <TableRow key={rev.id}>
                          <TableCell className="font-medium">#{rev.revision_number}</TableCell>
                          <TableCell className="text-muted-foreground">{formatStaffAppDate(rev.created_at)}</TableCell>
                          <TableCell className="text-muted-foreground">{rev.change_reason || "—"}</TableCell>
                        </TableRow>
                      ))}
                      {(detailQuery.data?.revisions ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                            {isKa ? "ვერსიები ვერ მოიძებნა." : "No revisions found."}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">{isKa ? "აირჩიეთ განაცხადი." : "Select an application to view."}</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffAppTab;
