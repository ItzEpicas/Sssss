import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardList, Loader2, ShieldCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction, EdgeFunctionError } from "@/lib/supabaseEdge";
import { staffApplicationCreateSchema, type StaffApplicationEditFormInput } from "@/lib/staff-applications/schema";
import {
  STAFF_APPLICATION_POSITIONS,
  type StaffApplication,
} from "@/lib/staff-applications/types";
import { getPositionLabel } from "@/lib/staff-applications/ui";
import StaffApplicationEditorDialog from "@/components/profile/StaffApplicationEditorDialog";

type DbProfileMini = {
  minecraft_nickname: string | null;
  discord_id: string | null;
};

const buildDefaultForm = (profile?: DbProfileMini | null): StaffApplicationEditFormInput => ({
  position: "helper",
  answers: {
    minecraftUsername: profile?.minecraft_nickname ?? "",
    age: undefined,
    discordTag: profile?.discord_id ?? "",
    timezone: "",
    serverPlaytime: "",
    availability: "",
    experience: "",
    motivation: "",
    additionalInfo: "",
    rulesAccepted: false,
  },
  changeReason: "",
});

const StaffApplicationSection: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();

  const isKa = language === "ka";

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDefaults, setEditorDefaults] = useState<StaffApplicationEditFormInput>(() => buildDefaultForm(null));

  const profileQuery = useQuery({
    queryKey: ["profile-mini", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("minecraft_nickname, discord_id")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as DbProfileMini | null;
    },
    staleTime: 1000 * 60,
  });

  useEffect(() => {
    setEditorDefaults(buildDefaultForm(profileQuery.data ?? null));
  }, [profileQuery.data]);

  const createMutation = useMutation({
    mutationFn: async (input: StaffApplicationEditFormInput) => {
      const parsed = staffApplicationCreateSchema.parse(input);
      return callEdgeFunction<{ application: StaffApplication }>("staff-applications", { method: "POST", body: parsed });
    },
    onSuccess: () => {
      toast({
        title: isKa ? "განაცხადი გაიგზავნა" : "Application submitted",
        description: isKa ? "თქვენი განაცხადი გადაცემულია განხილვაზე." : "Your staff application is now pending review.",
      });
    },
    onError: (error: Error) => {
      const retry =
        error instanceof EdgeFunctionError && error.retryAfterSeconds
          ? ` ${isKa ? "სცადეთ" : "Try again in"} ${error.retryAfterSeconds}s.`
          : "";
      toast({
        title: isKa ? "ვერ გაიგზავნა" : "Could not submit",
        description: `${error.message}${retry}`,
        variant: "destructive",
      });
    },
  });

  const canApply = !!user;

  const positions = useMemo(() => STAFF_APPLICATION_POSITIONS, []);

  const handleOpenApply = () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setEditorOpen(true);
  };

  return (
    <section id="staff-application" className="relative py-24 scroll-mt-24">
      <div className="absolute inset-0 gradient-radial opacity-30" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-10 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-10 right-0 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative">
        <div className="grid gap-10 lg:grid-cols-[1.1fr,0.9fr] items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-4 py-2 text-sm text-muted-foreground backdrop-blur">
              <Sparkles className="h-4 w-4 text-primary" />
              {isKa ? "დახვეწილი განაცხადის სისტემა" : "Modern application system"}
            </div>

            <h2 className="font-display font-black text-4xl md:text-5xl leading-tight">
              <span className="text-foreground">{isKa ? "გახდი" : "Join the"}</span>{" "}
              <span className="text-primary">{isKa ? "RageMC სტაფის" : "RageMC Staff"}</span>{" "}
              <span className="text-foreground">{isKa ? "წევრი" : "Team"}</span>
            </h2>

            <p className="text-muted-foreground text-lg max-w-xl">
              {isKa
                ? "თუ გინდა დაეხმარო კომუნითის, შეავსე სტაფის განაცხადი. შეგიძლია ნებისმიერ დროს შეცვალო პასუხები და ხელახლა გაგზავნო."
                : "Want to help the community? Submit a staff application. You can edit and resubmit any time — every change is saved as a revision."}
            </p>

            <div className="flex flex-wrap gap-2">
              {positions.map((pos) => (
                <Badge key={pos} variant="outline" className="border-primary/30">
                  {getPositionLabel(pos, language)}
                </Badge>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  {isKa ? "ვერსიების ისტორია" : "Revision history"}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {isKa ? "ყველა რედაქტირება ინახება და ჩანს ადმინ პანელში." : "Every edit is saved and visible in the admin panel."}
                </p>
              </div>

              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  {isKa ? "უსაფრთხო და დაცული" : "Secure by design"}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {isKa ? "როლებზე დაფუძნებული წვდომა და rate limit სპამის წინააღმდეგ." : "RBAC + rate limits to prevent spam and abuse."}
                </p>
              </div>
            </div>
          </div>

          <Card className="glass-card rounded-3xl border-border/40 shadow-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">
                {isKa ? "სტაფში განაცხადი" : "Staff Application"}
              </CardTitle>
              <CardDescription>
                {canApply
                  ? isKa
                    ? "დააჭირე ღილაკს და დაიწყე შევსება."
                    : "Click below to start your application."
                  : isKa
                    ? "განაცხადის გასაგზავნად საჭიროა ავტორიზაცია."
                    : "You need to be logged in to submit an application."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                size="lg"
                onClick={handleOpenApply}
                className="w-full gap-2 gradient-primary text-primary-foreground font-display font-extrabold text-base py-6 box-glow transition-all duration-300 hover:opacity-95 hover:scale-[1.01]"
              >
                {createMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                {canApply ? (isKa ? "განაცხადის შევსება" : "Apply now") : isKa ? "შესვლა" : "Login to apply"}
                <ArrowRight className="h-5 w-5 opacity-90" />
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => {
                  if (!user) {
                    navigate("/auth");
                    return;
                  }
                  navigate("/profile?tab=staff-app");
                }}
              >
                {isKa ? "ჩემი განაცხადები" : "View my applications"}
              </Button>

              <p className="text-xs text-muted-foreground">
                {isKa
                  ? "ლიმიტი: მაქსიმუმ 3 გაგზავნა/რედაქტირება საათში (სპამის წინააღმდეგ)."
                  : "Limit: up to 3 submissions/edits per hour (anti-spam)."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <StaffApplicationEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        title={isKa ? "სტაფის განაცხადი" : "Staff Application"}
        description={isKa ? "შეავსე ფორმა და გაგზავნე განაცხადი." : "Fill out the form and submit your application."}
        mode="create"
        defaultValues={editorDefaults}
        submitting={createMutation.isPending}
        onSubmit={async (values) => {
          try {
            await createMutation.mutateAsync(values);
            setEditorOpen(false);
          } catch {
            return;
          }
        }}
      />
    </section>
  );
};

export default StaffApplicationSection;
