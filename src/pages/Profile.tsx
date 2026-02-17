import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Loader2 } from "lucide-react";

type ProfileForm = {
  username: string;
  avatarUrl: string;
  bio: string;
  discord: string;
  minecraft: string;
};

const EMPTY_FORM: ProfileForm = {
  username: "",
  avatarUrl: "",
  bio: "",
  discord: "",
  minecraft: "",
};

const ProfilePage: React.FC = () => {
  const { user, loading, signOut, roles } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setForm(EMPTY_FORM);
      setCreatedAt(null);
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("username, avatar_url, bio, discord_id, minecraft_nickname, created_at")
      .eq("id", user.id)
      .maybeSingle();

    setLoadingProfile(false);

    if (error) {
      toast({
        title: "Unable to load profile",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setForm({
      username: data?.username ?? user.user_metadata?.username ?? "",
      avatarUrl: data?.avatar_url ?? "",
      bio: data?.bio ?? "",
      discord: data?.discord_id ?? "",
      minecraft: data?.minecraft_nickname ?? "",
    });
    setCreatedAt(data?.created_at ?? null);
  }, [toast, user]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }

    loadProfile();
  }, [loading, loadProfile, navigate, user]);

  const formattedCreatedAt = useMemo(() => {
    if (!createdAt) return null;
    return new Date(createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [createdAt]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!user) return;

    setSaving(true);

    const payload = {
      id: user.id,
      username: form.username.trim(),
      avatar_url: form.avatarUrl.trim() || null,
      bio: form.bio.trim(),
      discord_id: form.discord.trim(),
      minecraft_nickname: form.minecraft.trim(),
    };

    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("created_at")
      .maybeSingle();

    setSaving(false);

    if (error) {
      toast({
        title: "Could not save profile",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setCreatedAt(data?.created_at ?? createdAt);

    toast({
      title: "Profile saved",
      description: "Your account data has been updated.",
    });
  };

  const handleFieldChange = (key: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <Card className="shadow-lg">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                <Button variant="ghost" asChild className="p-0">
                  <Link to="/" className="flex items-center gap-1">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to home</span>
                  </Link>
                </Button>
                <span>Profile</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Update your RageMC account details and keep the Supabase profile in sync.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleSignOut}>
                    Sign out
                  </Button>
                  <Button
                    type="button"
                    onClick={loadProfile}
                    disabled={loadingProfile}
                    className="gradient-primary text-primary-foreground"
                  >
                    {loadingProfile ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      "Refresh"
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {loadingProfile ? (
                <div className="flex h-48 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[280px,1fr]">
                  <section className="space-y-4 rounded-xl border border-input/40 bg-muted p-5">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16">
                        {form.avatarUrl ? (
                          <AvatarImage src={form.avatarUrl} alt={form.username || "Avatar"} />
                        ) : (
                          <AvatarFallback>
                            {form.username?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "R"}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <p className="text-lg font-semibold">{form.username || "RageMC Member"}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Joined</p>
                      <p className="text-sm font-medium">{formattedCreatedAt ?? "Just now"}</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Roles</p>
                      <div className="flex flex-wrap gap-2">
                        {roles.length ? (
                          roles.map((role) => (
                            <span
                              key={role}
                              className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground"
                            >
                              {role}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs font-medium text-muted-foreground">User</span>
                        )}
                      </div>
                    </div>

                    <CardDescription className="text-sm text-muted-foreground">
                      Supabase keeps this profile data consistent for dashboards, tickets, and staff tools.
                    </CardDescription>
                  </section>

                  <section className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="profile-username">Username</Label>
                        <Input
                          id="profile-username"
                          value={form.username}
                          onChange={(event) => handleFieldChange("username", event.target.value)}
                          placeholder="Your in-game name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="profile-avatar">Avatar URL</Label>
                        <Input
                          id="profile-avatar"
                          value={form.avatarUrl}
                          onChange={(event) => handleFieldChange("avatarUrl", event.target.value)}
                          placeholder="https://example.com/avatar.png"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="profile-discord">Discord</Label>
                        <Input
                          id="profile-discord"
                          value={form.discord}
                          onChange={(event) => handleFieldChange("discord", event.target.value)}
                          placeholder="User#1234"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="profile-minecraft">Minecraft</Label>
                        <Input
                          id="profile-minecraft"
                          value={form.minecraft}
                          onChange={(event) => handleFieldChange("minecraft", event.target.value)}
                          placeholder="RageMC"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="profile-bio">Bio</Label>
                      <Textarea
                        id="profile-bio"
                        value={form.bio}
                        onChange={(event) => handleFieldChange("bio", event.target.value)}
                        rows={3}
                        placeholder="Tell the community what you enjoy..."
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <CardDescription className="text-xs text-muted-foreground">
                        Email is managed by Supabase Auth and can’t be changed here.
                      </CardDescription>
                      <Button type="submit" disabled={saving}>
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Save changes"
                        )}
                      </Button>
                    </div>
                  </section>
                </form>
              )}
            </CardContent>

            <CardFooter className="border-t border-border/50 text-sm text-muted-foreground">
              Keeping this profile current helps staff and support identify you faster.
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
