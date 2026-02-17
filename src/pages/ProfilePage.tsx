import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  Bell,
  CalendarDays,
  Coins,
  Copy,
  KeyRound,
  LogOut,
  Moon,
  Pencil,
  Save,
  Shield,
  ShoppingBag,
  Sun,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import StaffAppTab from "@/components/profile/StaffAppTab";

type DbProfile = {
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  discord_id: string | null;
  minecraft_nickname: string | null;
  created_at: string;
  updated_at: string;
};

type DbOrderItem = {
  item_name: string;
  item_price: number;
  quantity: number;
};

type DbOrder = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  order_items?: DbOrderItem[];
};

type ProfileFormState = {
  username: string;
  bio: string;
  discord: string;
  minecraft: string;
};

function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!domain) return email;
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  const masked = "*".repeat(Math.max(2, localPart.length - visible.length));
  return `${visible}${masked}@${domain}`;
}

function formatDate(dateIso: string | null | undefined) {
  if (!dateIso) return "\u2014";
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "\u2014";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(value: number) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "GEL" }).format(value);
  } catch {
    return `\u20BE${value.toFixed(2)}`;
  }
}

function safeLower(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

function useAnimatedNumber(target: number, durationMs = 900) {
  const [value, setValue] = useState(target);
  const rafRef = useRef<number | null>(null);
  const lastTargetRef = useRef(target);

  useEffect(() => {
    const startValue = Number.isFinite(lastTargetRef.current) ? lastTargetRef.current : 0;
    const endValue = Number.isFinite(target) ? target : 0;
    lastTargetRef.current = endValue;

    const start = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(startValue + (endValue - startValue) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [durationMs, target]);

  return value;
}

function getRoleLabel(roles: string[]) {
  if (roles.includes("owner")) return { label: "Owner", tone: "emerald" as const };
  if (roles.includes("admin") || roles.includes("manager")) return { label: "Admin", tone: "violet" as const };
  if (roles.includes("support") || roles.includes("moder") || roles.includes("helper"))
    return { label: "Staff", tone: "sky" as const };
  return { label: "User", tone: "zinc" as const };
}

const statusPill: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  processing: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  refunded: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  failed: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

function orderPrimaryProduct(order: DbOrder) {
  const items = order.order_items ?? [];
  if (!items.length) return "\u2014";
  if (items.length === 1) return items[0].item_name;
  return `${items[0].item_name} +${items.length - 1} more`;
}

function computeXp(totalSpend: number, totalOrders: number) {
  const spendXp = Math.floor(Math.max(0, totalSpend) * 18);
  const orderXp = Math.max(0, totalOrders) * 120;
  return spendXp + orderXp;
}

function computeLevel(xp: number) {
  const clamped = Math.max(0, Math.floor(xp));
  const level = Math.floor(clamped / 1200) + 1;
  const prev = (level - 1) * 1200;
  const next = level * 1200;
  const into = clamped - prev;
  const need = next - prev;
  const pct = need === 0 ? 0 : Math.min(100, Math.max(0, (into / need) * 100));
  return { level, xp: clamped, into, need, pct };
}

const ParticleField: React.FC<{ count?: number }> = ({ count = 14 }) => {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      key: `p-${i}`,
      left: `${Math.round(Math.random() * 100)}%`,
      top: `${Math.round(Math.random() * 100)}%`,
      size: Math.round(2 + Math.random() * 3),
      delay: `${(Math.random() * 6).toFixed(2)}s`,
      duration: `${(6 + Math.random() * 10).toFixed(2)}s`,
      opacity: 0.12 + Math.random() * 0.25,
    }));
  }, [count]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.key}
          className="absolute rounded-full bg-[#00ff88]"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            filter: "blur(0.2px)",
            animation: `profile-float ${p.duration} ease-in-out ${p.delay} infinite`,
          }}
        />
      ))}
    </div>
  );
};

const ProfilePage: React.FC = () => {
  const { user, loading: authLoading, signOut, roles } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();

  const parseTabFromLocation = (search: string) => {
    const raw = new URLSearchParams(search).get("tab");
    if (raw === "orders") return "orders";
    if (raw === "friends") return "friends";
    if (raw === "staff-app") return "staff-app";
    if (raw === "settings") return "settings";
    if (raw === "overview") return "overview";
    return "overview";
  };

  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "friends" | "staff-app" | "settings">(() =>
    parseTabFromLocation(location.search),
  );
  const [editMode, setEditMode] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    const raw = localStorage.getItem("profile.notifications");
    if (raw === "true") return true;
    if (raw === "false") return false;
    return true;
  });

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ password: "", confirm: "" });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const infoAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, navigate, user]);

  useEffect(() => {
    setActiveTab(parseTabFromLocation(location.search));
  }, [location.search]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, avatar_url, bio, discord_id, minecraft_nickname, created_at, updated_at")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as DbProfile | null;
    },
  });

  const ordersQuery = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, total_amount, created_at, order_items(item_name, item_price, quantity)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as DbOrder[];
    },
  });

  const derived = useMemo(() => {
    const profile = profileQuery.data;
    const username = profile?.username ?? (user?.user_metadata?.username as string | undefined) ?? "Player";
    const createdAt = profile?.created_at ?? user?.created_at ?? null;
    const role = getRoleLabel(roles ?? []);
    const avatarUrl = profile?.avatar_url ?? null;

    const orders = ordersQuery.data ?? [];
    const totalOrders = orders.length;
    const paidLike = new Set(["paid", "completed"]);
    const totalSpend = orders
      .filter((o) => paidLike.has(safeLower(o.status)))
      .reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0);

    const xp = computeXp(totalSpend, totalOrders);
    const level = computeLevel(xp);

    return {
      username,
      createdAt,
      role,
      avatarUrl,
      totalOrders,
      totalSpend,
      level,
    };
  }, [ordersQuery.data, profileQuery.data, roles, user]);

  const [form, setForm] = useState<ProfileFormState>({
    username: "",
    bio: "",
    discord: "",
    minecraft: "",
  });

  useEffect(() => {
    if (!user) return;
    const p = profileQuery.data;
    setForm({
      username: p?.username ?? (user.user_metadata?.username as string | undefined) ?? "",
      bio: p?.bio ?? "",
      discord: p?.discord_id ?? "",
      minecraft: p?.minecraft_nickname ?? "",
    });
  }, [profileQuery.data, user]);

  const uploadAvatar = async (file: File) => {
    if (!user) throw new Error("Not authenticated");

    const maxBytes = 3 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new Error("Avatar is too large. Please upload an image up to 3MB.");
    }

    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const path = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("Could not generate public URL for avatar.");
    return data.publicUrl;
  };

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      let avatarUrl = derived.avatarUrl;
      if (avatarFile) avatarUrl = await uploadAvatar(avatarFile);

      const payload = {
        id: user.id,
        username: form.username.trim() || null,
        bio: form.bio.trim() || null,
        discord_id: form.discord.trim() || null,
        minecraft_nickname: form.minecraft.trim() || null,
        avatar_url: avatarUrl || null,
      };

      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (error) throw error;

      return { avatarUrl };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      setEditMode(false);
      setAvatarFile(null);
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
      setAvatarPreviewUrl(null);
      toast({ title: "Profile updated", description: "Your changes are live." });
    },
    onError: (error: Error) => {
      toast({ title: "Could not update profile", description: error.message, variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const password = passwordForm.password.trim();
      const confirm = passwordForm.confirm.trim();
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");
      if (password !== confirm) throw new Error("Passwords do not match.");

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => {
      setPasswordForm({ password: "", confirm: "" });
      setPasswordDialogOpen(false);
      toast({ title: "Password changed", description: "Your account is secured with the new password." });
    },
    onError: (error: Error) => {
      toast({ title: "Password update failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: "Account deleted", description: "We\u2019re sorry to see you go." });
      await signOut();
      navigate("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message || "Unable to delete account. Ensure the SQL migration is applied.",
        variant: "destructive",
      });
    },
  });

  const animatedOrders = useAnimatedNumber(derived.totalOrders, 900);
  const animatedSpend = useAnimatedNumber(derived.totalSpend, 1100);
  const animatedLevel = useAnimatedNumber(derived.level.level, 800);
  const animatedXpPct = useAnimatedNumber(derived.level.pct, 1000);

  const pageDark = theme !== "light";
  const pageBg = pageDark ? "bg-[#0f0f14]" : "bg-[#f7f7fb]";
  const cardBg = pageDark ? "bg-white/5" : "bg-black/5";
  const cardBorder = pageDark ? "border-white/10" : "border-black/10";
  const mutedText = pageDark ? "text-white/60" : "text-black/60";
  const neon = "#00ff88";

  const handlePickAvatar = () => fileInputRef.current?.click();

  const onAvatarFileChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Unsupported file", description: "Please choose an image file.", variant: "destructive" });
      return;
    }

    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    const url = URL.createObjectURL(file);
    setAvatarFile(file);
    setAvatarPreviewUrl(url);
    setEditMode(true);
    setActiveTab("overview");
  };

  const handleCopy = async (value: string, label = "Copied") => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: label, description: "Saved to clipboard." });
    } catch {
      toast({
        title: "Copy failed",
        description: "Your browser blocked clipboard access. Try copying manually.",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const scrollToInfo = () => infoAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const heroLoading = authLoading || profileQuery.isLoading;

  if (!user && authLoading) {
    return (
      <div className={cn("min-h-screen", pageBg)}>
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-16">
          <Card className={cn("rounded-2xl border shadow-2xl", cardBg, cardBorder)}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (!user) return null;

  const maskedEmail = user.email ? maskEmail(user.email) : "\u2014";
  const joinLabel = formatDate(derived.createdAt);
  const roleToneClasses =
    derived.role.tone === "emerald"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : derived.role.tone === "violet"
        ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
        : derived.role.tone === "sky"
          ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
          : "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";

  return (
    <div className={cn("min-h-screen", pageBg, pageDark ? "text-white" : "text-black")}>
      <Navbar />

      {/* Premium background effects */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2">
          <div
            className={cn("h-[520px] w-[520px] rounded-full blur-3xl", pageDark ? "opacity-70" : "opacity-40")}
            style={{
              background: `radial-gradient(circle at 30% 30%, ${neon}33 0%, transparent 55%),
                           radial-gradient(circle at 70% 40%, #00d4ff22 0%, transparent 60%),
                           radial-gradient(circle at 50% 70%, #ff00ff14 0%, transparent 62%)`,
              animation: "profile-orb 12s ease-in-out infinite",
            }}
          />
        </div>
        <div
          className={cn(
            "absolute bottom-[-140px] right-[-160px] h-[520px] w-[520px] rounded-full blur-3xl",
            pageDark ? "opacity-60" : "opacity-30",
          )}
          style={{
            background: `radial-gradient(circle at 35% 35%, ${neon}22 0%, transparent 60%),
                         radial-gradient(circle at 60% 60%, #00d4ff1a 0%, transparent 62%)`,
            animation: "profile-orb 16s ease-in-out infinite reverse",
          }}
        />
        <ParticleField />
      </div>

      <div className="container mx-auto px-4 pt-24 pb-16">
        {/* HERO */}
        <Card className={cn("relative overflow-hidden rounded-2xl border shadow-2xl", cardBg, cardBorder)}>
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background:
                "linear-gradient(120deg, rgba(0,255,136,0.14) 0%, rgba(0,212,255,0.08) 45%, rgba(255,0,255,0.05) 100%)",
            }}
          />
          <div className={cn("relative p-6 sm:p-8", heroLoading && "opacity-90")}>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div
                    className="absolute -inset-3 rounded-full opacity-70 blur-xl"
                    style={{
                      background: `radial-gradient(circle, ${neon}55 0%, transparent 60%)`,
                      animation: "profile-pulse 2.4s ease-in-out infinite",
                    }}
                  />
                  <div
                    className="absolute -inset-1 rounded-full"
                    style={{
                      border: `1px solid ${neon}55`,
                      boxShadow: `0 0 22px ${neon}33`,
                      animation: "profile-ring 10s linear infinite",
                    }}
                  />

                  <Avatar
                    className={cn(
                      "relative h-20 w-20 border sm:h-24 sm:w-24",
                      pageDark ? "border-white/15" : "border-black/10",
                    )}
                    style={{ boxShadow: `0 0 0 2px ${neon}1f, 0 0 26px ${neon}22` }}
                  >
                    <AvatarImage src={avatarPreviewUrl ?? derived.avatarUrl ?? undefined} alt={derived.username} />
                    <AvatarFallback className={cn(pageDark ? "bg-black/40 text-white" : "bg-white/60 text-black")}>
                      {(derived.username || "P").slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <button
                    type="button"
                    onClick={handlePickAvatar}
                    className={cn(
                      "absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-full border backdrop-blur-xl transition",
                      pageDark ? "border-white/15 bg-black/40" : "border-black/10 bg-white/60",
                    )}
                    style={{ boxShadow: `0 0 18px ${neon}33` }}
                    aria-label="Upload avatar"
                  >
                    <Upload className="h-4 w-4" style={{ color: neon }} />
                  </button>

                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/70 backdrop-blur-xl">
                      <span className="relative h-2.5 w-2.5">
                        <span
                          className="absolute inline-flex h-full w-full rounded-full opacity-75"
                          style={{ backgroundColor: neon, animation: "profile-ping 1.6s ease-out infinite" }}
                        />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: neon }} />
                      </span>
                      <span>Online</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {heroLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-7 w-44" />
                      <Skeleton className="h-4 w-56" />
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-3">
                        <h1
                          className="text-2xl font-extrabold tracking-tight sm:text-3xl"
                          style={{
                            backgroundImage: `linear-gradient(90deg, ${neon}, #00d4ff, #b4ff00)`,
                            WebkitBackgroundClip: "text",
                            backgroundClip: "text",
                            color: "transparent",
                          }}
                        >
                          {derived.username}
                        </h1>
                        <Badge className={cn("rounded-full border px-3 py-1 text-xs", roleToneClasses)} variant="outline">
                          <Shield className="mr-1 h-3.5 w-3.5" />
                          {derived.role.label}
                        </Badge>
                      </div>
                      <div className={cn("flex flex-wrap items-center gap-3 text-sm", mutedText)}>
                        <span className="flex items-center gap-1.5">
                          <CalendarDays className="h-4 w-4" />
                          Joined {joinLabel}
                        </span>
                        <span className={cn("h-1 w-1 rounded-full", pageDark ? "bg-white/30" : "bg-black/30")} />
                        <span className="font-mono text-xs">{maskedEmail}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "rounded-2xl border backdrop-blur-xl transition",
                    pageDark
                      ? "border-white/15 bg-black/30 text-white hover:bg-black/40"
                      : "border-black/10 bg-white/70 text-black hover:bg-white",
                  )}
                  onClick={() => {
                    setEditMode((v) => !v);
                    setActiveTab("overview");
                    setTimeout(scrollToInfo, 80);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" style={{ color: neon }} />
                  {editMode ? "Exit edit" : "Edit profile"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "rounded-2xl border backdrop-blur-xl transition",
                    pageDark
                      ? "border-white/15 bg-black/30 text-white hover:bg-black/40"
                      : "border-black/10 bg-white/70 text-black hover:bg-white",
                  )}
                  onClick={() => setPasswordDialogOpen(true)}
                >
                  <KeyRound className="mr-2 h-4 w-4" style={{ color: neon }} />
                  Change password
                </Button>
                <Button
                  type="button"
                  className="rounded-2xl text-black"
                  style={{
                    background: `linear-gradient(135deg, ${neon} 0%, #00d4ff 100%)`,
                    boxShadow: `0 0 22px ${neon}33`,
                  }}
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarFileChange} />
          </div>
        </Card>

        <div className="mt-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList
              className={cn(
                "grid w-full grid-cols-2 gap-1 rounded-2xl p-1 sm:grid-cols-5",
                pageDark ? "bg-white/5" : "bg-black/5",
              )}
            >
              <TabsTrigger value="overview" className="rounded-xl data-[state=active]:shadow">
                Overview
              </TabsTrigger>
              <TabsTrigger value="orders" className="rounded-xl data-[state=active]:shadow">
                Orders
              </TabsTrigger>
              <TabsTrigger value="friends" className="rounded-xl data-[state=active]:shadow">
                Friends
              </TabsTrigger>
              <TabsTrigger value="staff-app" className="rounded-xl data-[state=active]:shadow">
                Staff App
              </TabsTrigger>
              <TabsTrigger value="settings" className="rounded-xl data-[state=active]:shadow">
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="overview"
              className="mt-6 data-[state=active]:animate-in data-[state=active]:fade-in-0"
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Total Orders"
                  icon={ShoppingBag}
                  loading={ordersQuery.isLoading}
                  value={Math.max(0, Math.round(animatedOrders))}
                  accent={neon}
                  pageDark={pageDark}
                />
                <StatCard
                  title="Total Purchases"
                  icon={Coins}
                  loading={ordersQuery.isLoading}
                  value={formatCurrency(animatedSpend)}
                  accent={neon}
                  pageDark={pageDark}
                />
                <LevelCard
                  title="Account Level"
                  icon={Shield}
                  loading={ordersQuery.isLoading}
                  level={Math.max(1, Math.round(animatedLevel))}
                  xpInto={derived.level.into}
                  xpNeed={derived.level.need}
                  pct={animatedXpPct}
                  accent={neon}
                  pageDark={pageDark}
                />
                <StatCard
                  title="Joined Date"
                  icon={CalendarDays}
                  loading={profileQuery.isLoading}
                  value={joinLabel}
                  accent={neon}
                  pageDark={pageDark}
                />
              </div>

              <div ref={infoAnchorRef} className="mt-6 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
                <Card className={cn("rounded-2xl border shadow-xl", cardBg, cardBorder)}>
                  <CardHeader className="pb-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="text-xl">Profile Info</CardTitle>
                        <CardDescription className={cn(mutedText)}>
                          Manage your public details and keep Supabase in sync.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={editMode} onCheckedChange={setEditMode} />
                        <span className={cn("text-sm font-medium", mutedText)}>Edit mode</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Email"
                        value={maskedEmail}
                        pageDark={pageDark}
                        mutedText={mutedText}
                        right={
                          user.email ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className={cn(
                                "h-9 w-9 rounded-xl border",
                                pageDark ? "border-white/15 bg-black/20" : "border-black/10 bg-white/60",
                              )}
                              onClick={() => handleCopy(user.email!, "Email copied")}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          ) : null
                        }
                      />
                      <Field
                        label="User ID"
                        value={user.id}
                        mono
                        pageDark={pageDark}
                        mutedText={mutedText}
                        right={
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className={cn(
                              "h-9 w-9 rounded-xl border",
                              pageDark ? "border-white/15 bg-black/20" : "border-black/10 bg-white/60",
                            )}
                            onClick={() => handleCopy(user.id, "User ID copied")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        }
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className={cn(mutedText)}>Minecraft Username</Label>
                        {editMode ? (
                          <Input
                            value={form.minecraft}
                            onChange={(e) => setForm((p) => ({ ...p, minecraft: e.target.value }))}
                            placeholder="Your Minecraft username"
                            className={cn(
                              "rounded-2xl",
                              pageDark ? "bg-black/20 border-white/10" : "bg-white/60 border-black/10",
                            )}
                          />
                        ) : (
                          <div
                            className={cn(
                              "rounded-2xl border px-4 py-3",
                              pageDark ? "border-white/10 bg-black/20" : "border-black/10 bg-white/60",
                            )}
                          >
                            <span className="font-medium">{form.minecraft || "\u2014"}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className={cn(mutedText)}>Discord Username</Label>
                        {editMode ? (
                          <Input
                            value={form.discord}
                            onChange={(e) => setForm((p) => ({ ...p, discord: e.target.value }))}
                            placeholder="name#0000 or @name"
                            className={cn(
                              "rounded-2xl",
                              pageDark ? "bg-black/20 border-white/10" : "bg-white/60 border-black/10",
                            )}
                          />
                        ) : (
                          <div
                            className={cn(
                              "rounded-2xl border px-4 py-3",
                              pageDark ? "border-white/10 bg-black/20" : "border-black/10 bg-white/60",
                            )}
                          >
                            <span className="font-medium">{form.discord || "\u2014"}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className={cn(mutedText)}>Username</Label>
                      {editMode ? (
                        <Input
                          value={form.username}
                          onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                          placeholder="Display name"
                          className={cn(
                            "rounded-2xl",
                            pageDark ? "bg-black/20 border-white/10" : "bg-white/60 border-black/10",
                          )}
                        />
                      ) : (
                        <div
                          className={cn(
                            "rounded-2xl border px-4 py-3",
                            pageDark ? "border-white/10 bg-black/20" : "border-black/10 bg-white/60",
                          )}
                        >
                          <span className="font-medium">{form.username || "\u2014"}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className={cn(mutedText)}>Bio</Label>
                      {editMode ? (
                        <Textarea
                          value={form.bio}
                          onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                          rows={4}
                          placeholder="Tell the community what you\u2019re grinding..."
                          className={cn(
                            "rounded-2xl",
                            pageDark ? "bg-black/20 border-white/10" : "bg-white/60 border-black/10",
                          )}
                        />
                      ) : (
                        <div
                          className={cn(
                            "rounded-2xl border px-4 py-3",
                            pageDark ? "border-white/10 bg-black/20" : "border-black/10 bg-white/60",
                          )}
                        >
                          <p className={cn("text-sm leading-relaxed", mutedText)}>{form.bio || "\u2014"}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className={cn("text-xs", mutedText)}>
                        Email is managed by Supabase Auth. Profile fields are stored in `profiles`.
                      </p>
                      <Button
                        type="button"
                        disabled={!editMode || saveProfileMutation.isPending}
                        className="rounded-2xl text-black disabled:opacity-60"
                        style={{
                          background: `linear-gradient(135deg, ${neon} 0%, #00d4ff 100%)`,
                          boxShadow: `0 0 18px ${neon}2b`,
                        }}
                        onClick={() => saveProfileMutation.mutate()}
                      >
                        {saveProfileMutation.isPending ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                            Saving\u2026
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <Save className="h-4 w-4" />
                            Save changes
                          </span>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <Card className={cn("rounded-2xl border shadow-xl", cardBg, cardBorder)}>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Quick Actions</CardTitle>
                    <CardDescription className={cn(mutedText)}>Fast shortcuts for your account.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-between rounded-2xl border",
                        pageDark ? "border-white/15 bg-black/20 text-white" : "border-black/10 bg-white/60 text-black",
                      )}
                      onClick={() => setPasswordDialogOpen(true)}
                    >
                      <span className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4" style={{ color: neon }} />
                        Change password
                      </span>
                      <span className={cn("text-xs", mutedText)}>Secure</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-between rounded-2xl border",
                        pageDark ? "border-white/15 bg-black/20 text-white" : "border-black/10 bg-white/60 text-black",
                      )}
                      onClick={() => setActiveTab("orders")}
                    >
                      <span className="flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4" style={{ color: neon }} />
                        View order history
                      </span>
                      <span className={cn("text-xs", mutedText)}>{derived.totalOrders} orders</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-between rounded-2xl border",
                        pageDark ? "border-white/15 bg-black/20 text-white" : "border-black/10 bg-white/60 text-black",
                      )}
                      onClick={() => {
                        setEditMode(true);
                        setTimeout(scrollToInfo, 80);
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <Pencil className="h-4 w-4" style={{ color: neon }} />
                        Edit profile info
                      </span>
                      <span className={cn("text-xs", mutedText)}>Profile</span>
                    </Button>

                    <Button
                      type="button"
                      className="w-full rounded-2xl text-black"
                      style={{
                        background: `linear-gradient(135deg, ${neon} 0%, #00d4ff 100%)`,
                        boxShadow: `0 0 18px ${neon}2b`,
                      }}
                      onClick={handleSignOut}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent
              value="orders"
              className="mt-6 data-[state=active]:animate-in data-[state=active]:fade-in-0"
            >
              <Card className={cn("rounded-2xl border shadow-xl", cardBg, cardBorder)}>
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">Order History</CardTitle>
                  <CardDescription className={cn(mutedText)}>Your latest purchases and status updates.</CardDescription>
                </CardHeader>
                <CardContent>
                  {ordersQuery.isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : ordersQuery.isError ? (
                    <div
                      className={cn(
                        "rounded-2xl border p-4",
                        pageDark ? "border-white/10 bg-black/20" : "border-black/10 bg-white/60",
                      )}
                    >
                      <p className="font-medium">Could not load orders.</p>
                      <p className={cn("text-sm", mutedText)}>
                        {(ordersQuery.error as Error)?.message ?? "Unknown error"}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className={cn(pageDark ? "border-white/10" : "border-black/10")}>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(ordersQuery.data ?? []).map((order) => {
                            const status = safeLower(order.status);
                            const pill = statusPill[status] ?? "bg-zinc-500/10 text-zinc-300 border-zinc-500/20";
                            return (
                              <TableRow key={order.id} className={cn(pageDark ? "border-white/10" : "border-black/10")}>
                                <TableCell className="font-mono text-xs">
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-2 hover:underline"
                                    onClick={() => handleCopy(order.id, "Order ID copied")}
                                  >
                                    {order.id.slice(0, 8)}...
                                    <Copy className="h-3.5 w-3.5 opacity-70" />
                                  </button>
                                </TableCell>
                                <TableCell className="min-w-[240px]">{orderPrimaryProduct(order)}</TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(Number(order.total_amount ?? 0))}
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={cn(
                                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium capitalize",
                                      pill,
                                    )}
                                  >
                                    {status || "unknown"}
                                  </span>
                                </TableCell>
                                <TableCell className={cn("whitespace-nowrap", mutedText)}>
                                  {formatDate(order.created_at)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {(!ordersQuery.data || ordersQuery.data.length === 0) && (
                            <TableRow className={cn(pageDark ? "border-white/10" : "border-black/10")}>
                              <TableCell colSpan={5} className={cn("py-10 text-center", mutedText)}>
                                No orders yet.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent
              value="friends"
              className="mt-6 data-[state=active]:animate-in data-[state=active]:fade-in-0"
            >
              <Card className={cn("rounded-2xl border shadow-xl", cardBg, cardBorder)}>
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">Friends</CardTitle>
                  <CardDescription className={cn(mutedText)}>
                    Coming soon — add friends, see who's online, and share your profile.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className={cn(
                      "rounded-2xl border p-4 text-sm",
                      pageDark ? "border-white/10 bg-black/20" : "border-black/10 bg-white/60",
                    )}
                  >
                    This section is under development.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent
              value="staff-app"
              className="mt-6 data-[state=active]:animate-in data-[state=active]:fade-in-0"
            >
              <StaffAppTab
                defaultAnswers={{
                  minecraftUsername: profileQuery.data?.minecraft_nickname ?? "",
                  discordTag: profileQuery.data?.discord_id ?? "",
                }}
              />
            </TabsContent>

            <TabsContent
              value="settings"
              className="mt-6 data-[state=active]:animate-in data-[state=active]:fade-in-0"
            >
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className={cn("rounded-2xl border shadow-xl", cardBg, cardBorder)}>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Preferences</CardTitle>
                    <CardDescription className={cn(mutedText)}>Make it yours.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div
                      className={cn(
                        "flex items-center justify-between rounded-2xl border p-4",
                        pageDark ? "border-white/10 bg-black/20" : "border-black/10 bg-white/60",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "grid h-10 w-10 place-items-center rounded-2xl border",
                            pageDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/5",
                          )}
                          style={{ boxShadow: `0 0 18px ${neon}22` }}
                        >
                          {pageDark ? (
                            <Moon className="h-5 w-5" style={{ color: neon }} />
                          ) : (
                            <Sun className="h-5 w-5" style={{ color: neon }} />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">Theme</p>
                          <p className={cn("text-sm", mutedText)}>{pageDark ? "Dark" : "Light"} mode</p>
                        </div>
                      </div>
                      <Switch
                        checked={!pageDark}
                        onCheckedChange={(checked) => setTheme(checked ? "light" : "dark")}
                        aria-label="Toggle theme"
                      />
                    </div>

                    <div
                      className={cn(
                        "flex items-center justify-between rounded-2xl border p-4",
                        pageDark ? "border-white/10 bg-black/20" : "border-black/10 bg-white/60",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "grid h-10 w-10 place-items-center rounded-2xl border",
                            pageDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/5",
                          )}
                          style={{ boxShadow: `0 0 18px ${neon}22` }}
                        >
                          <Bell className="h-5 w-5" style={{ color: neon }} />
                        </div>
                        <div>
                          <p className="font-medium">Notifications</p>
                          <p className={cn("text-sm", mutedText)}>
                            {notificationsEnabled ? "Enabled" : "Disabled"} (stored on this device)
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={notificationsEnabled}
                        onCheckedChange={(checked) => {
                          setNotificationsEnabled(checked);
                          localStorage.setItem("profile.notifications", checked ? "true" : "false");
                          toast({
                            title: "Preferences saved",
                            description: checked ? "Notifications enabled." : "Notifications disabled.",
                          });
                        }}
                        aria-label="Toggle notifications"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className={cn("rounded-2xl border shadow-xl", cardBg, cardBorder)}>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Danger Zone</CardTitle>
                    <CardDescription className={cn(mutedText)}>
                      Irreversible actions. Proceed carefully.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="destructive"
                          className="w-full rounded-2xl"
                          disabled={deleteAccountMutation.isPending}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {deleteAccountMutation.isPending ? "Deleting\u2026" : "Delete account"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently deletes your Supabase Auth user. Your profile will be removed; orders may remain
                            for accounting with your `user_id` set to null.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteAccountMutation.mutate()}
                          >
                            Yes, delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <p className={cn("text-xs", mutedText)}>
                      Account deletion uses a SQL RPC function (`delete_my_account`). Apply the migration before using.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>Set a new password for your Supabase account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={passwordForm.password}
                onChange={(e) => setPasswordForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="********"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
                placeholder="********"
              />
            </div>
            <Button type="button" className="w-full" disabled={changePasswordMutation.isPending} onClick={() => changePasswordMutation.mutate()}>
              {changePasswordMutation.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                  Updating\u2026
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Update password
                </span>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

const StatCard: React.FC<{
  title: string;
  value: React.ReactNode;
  icon: LucideIcon;
  loading?: boolean;
  accent: string;
  pageDark: boolean;
}> = ({ title, value, icon: Icon, loading, accent, pageDark }) => {
  const cardBg = pageDark ? "bg-white/5" : "bg-black/5";
  const cardBorder = pageDark ? "border-white/10" : "border-black/10";
  const muted = pageDark ? "text-white/60" : "text-black/60";

  return (
    <Card
      className={cn(
        "group rounded-2xl border shadow-xl transition-transform duration-300 hover:-translate-y-1 hover:shadow-2xl",
        cardBg,
        cardBorder,
      )}
      style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold tracking-wide">{title}</CardTitle>
            <CardDescription className={cn("text-xs", muted)}>Live from Supabase</CardDescription>
          </div>
          <div
            className={cn(
              "grid h-10 w-10 place-items-center rounded-2xl border backdrop-blur-xl",
              pageDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/5",
            )}
            style={{ boxShadow: `0 0 18px ${accent}2b` }}
          >
            <Icon className="h-5 w-5" style={{ color: accent }} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-32 rounded-xl" /> : <div className="text-2xl font-extrabold">{value}</div>}
      </CardContent>
    </Card>
  );
};

const LevelCard: React.FC<{
  title: string;
  level: number;
  icon: LucideIcon;
  loading?: boolean;
  xpInto: number;
  xpNeed: number;
  pct: number;
  accent: string;
  pageDark: boolean;
}> = ({ title, level, icon: Icon, loading, xpInto, xpNeed, pct, accent, pageDark }) => {
  const cardBg = pageDark ? "bg-white/5" : "bg-black/5";
  const cardBorder = pageDark ? "border-white/10" : "border-black/10";
  const muted = pageDark ? "text-white/60" : "text-black/60";

  return (
    <Card
      className={cn(
        "group rounded-2xl border shadow-xl transition-transform duration-300 hover:-translate-y-1 hover:shadow-2xl",
        cardBg,
        cardBorder,
      )}
      style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold tracking-wide">{title}</CardTitle>
            <CardDescription className={cn("text-xs", muted)}>XP from purchases + orders</CardDescription>
          </div>
          <div
            className={cn(
              "grid h-10 w-10 place-items-center rounded-2xl border backdrop-blur-xl",
              pageDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/5",
            )}
            style={{ boxShadow: `0 0 18px ${accent}2b` }}
          >
            <Icon className="h-5 w-5" style={{ color: accent }} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-8 w-28 rounded-xl" />
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="h-4 w-40 rounded-xl" />
          </>
        ) : (
          <>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-extrabold">Lv. {level}</div>
              <div className={cn("text-xs font-medium", muted)}>
                {Math.max(0, Math.floor(xpInto))} / {Math.max(1, Math.floor(xpNeed))} XP
              </div>
            </div>
            <div className="space-y-2">
              <Progress value={pct} className={cn("h-2 rounded-full", pageDark ? "bg-white/10" : "bg-black/10")} />
              <div className={cn("text-xs", muted)}>{Math.round(pct)}% to next level</div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  right?: React.ReactNode;
  mono?: boolean;
  pageDark: boolean;
  mutedText: string;
}> = ({ label, value, right, mono, pageDark, mutedText }) => {
  return (
    <div className="space-y-2">
      <Label className={cn(mutedText)}>{label}</Label>
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3",
          pageDark ? "border-white/10 bg-black/20" : "border-black/10 bg-white/60",
        )}
      >
        <span className={cn("truncate text-sm font-medium", mono && "font-mono text-xs")}>{value}</span>
        {right}
      </div>
    </div>
  );
};

export default ProfilePage;
