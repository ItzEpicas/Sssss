import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Clipboard,
  Copy,
  Download,
  ExternalLink,
  Gamepad2,
  Loader2,
  LogIn,
  PlusSquare,
  Rocket,
  Server,
  ShieldCheck,
  Sparkles,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Step = 'ownership' | 'guide';

type StartPlayingOverlayProps = {
  onClose: () => void;
  ip?: string;
  title?: string;
};

const DEFAULT_IP = 'play.ragemc.ge';
const DEFAULT_TITLE = 'RageMC';
const TLAUNCHER_URL = 'https://tlauncher.org/en/';
const STEVE_RENDER_URL =
  'https://crafatar.com/renders/body/8667ba71b85a4004af54457a9734eed7?overlay';
const CHARACTER_IMAGE_SOURCES = [
  '/steve.webp',
  '/steve.png',
  STEVE_RENDER_URL,
  'https://mc-heads.net/body/8667ba71b85a4004af54457a9734eed7',
  'https://minotar.net/body/Notch/400.png',
  '/steve-placeholder.svg',
] as const;

type LiveStatus = {
  online: boolean;
  playersOnline: number | null;
  playersMax: number | null;
  version: string | null;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const coerceFirstLine = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry !== 'string') continue;
      const trimmed = entry.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

const fetchLiveStatus = async (ip: string, signal: AbortSignal): Promise<LiveStatus> => {
  const primaryUrl = `/api/mcsrvstat/3/${encodeURIComponent(ip)}`;
  const fallbackUrl = `https://mcapi.us/server/status?ip=${encodeURIComponent(ip)}`;

  const fetchPrimary = async () => {
    if (!import.meta.env.DEV) throw new Error('Primary disabled');
    const res = await fetch(primaryUrl, { method: 'GET', signal, cache: 'no-store' });
    if (!res.ok) throw new Error('Primary failed');
    const json: unknown = await res.json();
    const data =
      typeof json === 'object' && json !== null
        ? (json as Record<string, unknown>)
        : {};
    const playersRaw = data.players;
    const players =
      typeof playersRaw === 'object' && playersRaw !== null
        ? (playersRaw as Record<string, unknown>)
        : {};

    return {
      online: Boolean(data.online),
      playersOnline: toNumberOrNull(players.online),
      playersMax: toNumberOrNull(players.max),
      version: typeof data.version === 'string' ? (data.version as string).trim() : null,
    };
  };

  const fetchFallback = async () => {
    const res = await fetch(fallbackUrl, { method: 'GET', signal, cache: 'no-store' });
    if (!res.ok) throw new Error('Fallback failed');
    const json: unknown = await res.json();
    const data =
      typeof json === 'object' && json !== null
        ? (json as Record<string, unknown>)
        : {};
    const playersRaw = data.players;
    const players =
      typeof playersRaw === 'object' && playersRaw !== null
        ? (playersRaw as Record<string, unknown>)
        : {};
    const serverRaw = data.server;
    const server =
      typeof serverRaw === 'object' && serverRaw !== null
        ? (serverRaw as Record<string, unknown>)
        : {};

    const serverName = typeof server.name === 'string' ? (server.name as string).trim() : '';
    const motd = coerceFirstLine(data.motd);

    return {
      online: Boolean(data.online),
      playersOnline: toNumberOrNull(players.now ?? players.online),
      playersMax: toNumberOrNull(players.max),
      version: serverName || motd || null,
    };
  };

  try {
    return await fetchPrimary();
  } catch {
    return await fetchFallback();
  }
};

export default function StartPlayingOverlay({
  onClose,
  ip = DEFAULT_IP,
  title = DEFAULT_TITLE,
}: StartPlayingOverlayProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('ownership');
  const [closing, setClosing] = useState(false);

  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(false);

  const joinedSteps = useMemo(
    () => [
      { key: 'open', icon: Gamepad2, text: 'გახსენი Minecraft Java Edition' },
      { key: 'multiplayer', icon: Users, text: 'დააჭირე Multiplayer' },
      { key: 'add', icon: PlusSquare, text: 'აირჩიე Add Server' },
      { key: 'address', icon: Clipboard, text: 'Server Address-ში ჩაწერე ან ჩასვი IP' },
      { key: 'join', icon: LogIn, text: 'დააჭირე Join Server და ისიამოვნე' },
    ],
    [],
  );

  const particles = useMemo(
    () => [
      { top: '12%', left: '10%', size: 6, opacity: 0.55, delay: '0s' },
      { top: '22%', left: '78%', size: 8, opacity: 0.45, delay: '0.6s' },
      { top: '68%', left: '84%', size: 6, opacity: 0.4, delay: '1.2s' },
      { top: '78%', left: '18%', size: 7, opacity: 0.48, delay: '0.9s' },
      { top: '38%', left: '42%', size: 5, opacity: 0.35, delay: '1.6s' },
    ],
    [],
  );

  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      onClose();
    }, 350);
  }, [closing, onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleClose]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
      if (closeTimeoutRef.current) window.clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const handleCopyIp = useCallback(async () => {
    const showCopied = () => {
      setCopied(true);
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 1500);
      toast({
        title: 'IP დაკოპირდა!',
        description: ip,
      });
    };

    try {
      await navigator.clipboard.writeText(ip);
      showCopied();
      return;
    } catch {
      // fall back
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = ip;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showCopied();
    } catch {
      // ignore
    }
  }, [ip, toast]);

  useEffect(() => {
    if (step !== 'guide') return;

    const controller = new AbortController();
    let intervalId: number | null = null;

    const load = async () => {
      if (controller.signal.aborted) return;
      setLiveLoading(true);
      setLiveError(false);
      try {
        const result = await fetchLiveStatus(ip, controller.signal);
        if (controller.signal.aborted) return;
        setLiveStatus(result);
      } catch {
        if (controller.signal.aborted) return;
        setLiveError(true);
        setLiveStatus({ online: false, playersOnline: null, playersMax: null, version: null });
      } finally {
        if (!controller.signal.aborted) {
          setLiveLoading(false);
        }
      }
    };

    load();
    intervalId = window.setInterval(load, 30_000);

    return () => {
      controller.abort();
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [ip, step]);

  const handleHasMinecraft = useCallback(() => {
    setStep('guide');
  }, []);

  const handleNoMinecraft = useCallback(() => {
    window.location.href = TLAUNCHER_URL;
  }, []);

  const handleJoinAction = useCallback(() => {
    handleClose();
    window.setTimeout(() => {
      document.getElementById('server-status')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 420);
  }, [handleClose]);

  const online = Boolean(liveStatus?.online);
  const playersLabel =
    liveStatus?.playersOnline != null && liveStatus?.playersMax != null
      ? `${liveStatus.playersOnline}/${liveStatus.playersMax}`
      : null;
  const liveVersion =
    liveStatus?.version && liveStatus.version.trim() ? liveStatus.version.trim() : null;

  const contentAnimation = closing
    ? 'animate-out fade-out zoom-out-95 duration-300'
    : 'animate-in fade-in zoom-in-95 duration-500';
  const backdropAnimation = closing
    ? 'animate-out fade-out duration-300'
    : 'animate-in fade-in duration-500';

  const [characterSourceIndex, setCharacterSourceIndex] = useState(0);
  const [characterLoaded, setCharacterLoaded] = useState(false);

  const characterSrc =
    characterSourceIndex < CHARACTER_IMAGE_SOURCES.length
      ? CHARACTER_IMAGE_SOURCES[characterSourceIndex]
      : null;

  useEffect(() => {
    setCharacterLoaded(false);
  }, [characterSourceIndex]);

  const handleCharacterError = useCallback(() => {
    setCharacterSourceIndex((current) =>
      current + 1 < CHARACTER_IMAGE_SOURCES.length
        ? current + 1
        : CHARACTER_IMAGE_SOURCES.length,
    );
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-label="სერვერზე შესვლის გზამკვლევი"
    >
      {/* Backdrop */}
      <div
        className={[
          'fixed inset-0',
          'bg-slate-950/55 supports-[backdrop-filter]:bg-slate-950/35',
          'supports-[backdrop-filter]:backdrop-blur-xl',
          backdropAnimation,
        ].join(' ')}
      />
      <div
        className={[
          'fixed inset-0',
          'bg-gradient-to-br from-cyan-300/25 via-sky-300/15 to-indigo-500/20',
          backdropAnimation,
        ].join(' ')}
      />
      <div className="fixed inset-0 mc-clouds opacity-20 pointer-events-none motion-reduce:animate-none" />
      <div className="fixed inset-0 mc-clouds-2 opacity-12 pointer-events-none motion-reduce:animate-none" />

      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none motion-reduce:hidden">
        {particles.map((p, index) => (
          <div
            key={`p-${index}`}
            className="absolute rounded-full bg-white/70 animate-float motion-reduce:animate-none"
            style={{
              top: p.top,
              left: p.left,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: p.opacity,
              animationDelay: p.delay,
            }}
          />
        ))}
      </div>

      {/* Click-catcher */}
      <div
        aria-hidden="true"
        onClick={handleClose}
        className="fixed inset-0 cursor-default"
      />

      <button
        type="button"
        onClick={handleClose}
        aria-label="დახურვა"
        className="fixed right-4 top-4 z-[110] inline-flex items-center justify-center h-10 w-10 rounded-xl border border-white/15 bg-slate-950/35 text-white/90 backdrop-blur-md hover:bg-slate-950/45 transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Content */}
      <div className="relative min-h-screen flex items-start justify-center px-4 pt-16 pb-6 sm:pt-10 sm:pb-8">
        <div className={['w-full max-w-4xl', contentAnimation].join(' ')}>
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr] gap-6 lg:gap-8 items-start">
            {/* Character */}
            <div className="order-2 lg:order-1 relative mx-auto w-full max-w-[240px] sm:max-w-sm lg:max-w-none">
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 h-10 w-64 rounded-full bg-slate-950/35 blur-2xl" />
              <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-white/20 to-transparent blur-2xl opacity-50" />

              <div className="relative aspect-[4/5] w-full">
                {!characterLoaded && (
                  <div className="absolute inset-0 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md">
                    <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.12),transparent)] bg-[length:200%_100%] animate-shimmer motion-reduce:animate-none" />
                  </div>
                )}

                {characterSrc ? (
                  <img
                    src={characterSrc}
                    alt="Minecraft პერსონაჟი"
                    decoding="async"
                    loading="eager"
                    referrerPolicy="no-referrer"
                    onLoad={() => setCharacterLoaded(true)}
                    onError={handleCharacterError}
                    className="relative h-full w-full rounded-3xl object-contain animate-float motion-reduce:animate-none transform-gpu will-change-transform drop-shadow-[0_35px_45px_rgba(0,0,0,0.35)]"
                  />
                ) : (
                  <div className="relative h-full w-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
                    <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center text-white/80">
                      <Gamepad2 className="h-10 w-10 text-cyan-200" />
                      <div className="text-sm font-semibold">პერსონაჟის სურათი ვერ ჩაიტვირთა</div>
                      <div className="text-xs text-white/60">
                        ჩააგდე ფაილი{' '}
                        <span className="font-mono text-white/80">public/steve.webp</span>-ში (ან{' '}
                        <span className="font-mono text-white/80">public/steve.png</span>), რომ ყოველთვის
                        გამოჩნდეს.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Panel */}
            <div className="order-1 lg:order-2 relative overflow-hidden rounded-3xl border border-white/15 bg-slate-950/40 backdrop-blur-xl shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
              <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl pointer-events-none" />

              <div className="relative p-5 sm:p-6 md:p-7">
                {step === 'ownership' ? (
                  <div className="animate-in fade-in zoom-in-95 duration-500 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                      <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                      {title} გზამკვლევი
                    </div>

                    <h2 className="mt-4 font-display text-xl sm:text-2xl font-black tracking-tight text-foreground">
                      გაქვს თუ არა Minecraft ნაყიდი?
                    </h2>
                    <p className="mt-2 text-muted-foreground">
                      აირჩიე ვარიანტი და დაგეხმარებით სწრაფად შემოხვიდე RageMC-ზე.
                    </p>

                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        aria-label="მაქვს Minecraft ნაყიდი"
                        onClick={handleHasMinecraft}
                        className={[
                          'group inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-display font-extrabold',
                          'bg-emerald-400 text-slate-950 shadow-[0_18px_45px_rgba(16,185,129,0.25)]',
                          'hover:bg-emerald-300 hover:shadow-[0_22px_55px_rgba(16,185,129,0.35)]',
                          'transition-all duration-300 hover:scale-[1.03] active:scale-[1.01]',
                        ].join(' ')}
                      >
                        <ShieldCheck className="h-5 w-5" />
                        მაქვს
                      </button>

                      <button
                        type="button"
                        aria-label="არ მაქვს Minecraft ნაყიდი"
                        onClick={handleNoMinecraft}
                        className={[
                          'group inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-display font-extrabold',
                          'bg-cyan-400/90 text-slate-950 shadow-[0_18px_45px_rgba(56,189,248,0.25)]',
                          'hover:bg-cyan-300 hover:shadow-[0_22px_55px_rgba(56,189,248,0.35)]',
                          'transition-all duration-300 hover:scale-[1.03] active:scale-[1.01]',
                        ].join(' ')}
                      >
                        <Download className="h-5 w-5" />
                        არ მაქვს
                      </button>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted-foreground">
                      „არ მაქვს“-ზე დაჭერისას გადაგიყვანთ TLauncher-ის ოფიციალურ გვერდზე{' '}
                      <span className="inline-flex items-center gap-1 text-foreground/90 font-semibold">
                        (tlauncher.org) <ExternalLink className="h-3.5 w-3.5" />
                      </span>
                      .
                    </div>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="font-display text-xl sm:text-2xl font-black tracking-tight text-foreground">
                          როგორ შემოხვიდე {title}-ზე
                        </h2>
                        <p className="mt-1 text-muted-foreground">
                          ყველაფერი მზადაა — დარჩა მხოლოდ 1 წუთი.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={[
                            'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold',
                            liveLoading
                              ? 'border-white/10 bg-white/5 text-white/70'
                              : online
                                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
                                : 'border-rose-500/30 bg-rose-500/15 text-rose-200',
                          ].join(' ')}
                        >
                          {liveLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : online ? (
                            <Wifi className="h-4 w-4" />
                          ) : (
                            <WifiOff className="h-4 w-4" />
                          )}
                          <span>
                            {liveLoading ? 'ამოწმებს...' : online ? 'ონლაინ' : 'ოფლაინ'}
                          </span>
                        </span>

                        {playersLabel && !liveLoading && !liveError && (
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                            <Users className="h-4 w-4" /> {playersLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 space-y-3">
                      <div className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <Server className="h-4 w-4 text-cyan-200" />
                        სერვერის IP
                      </div>

                      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-base md:text-lg font-extrabold text-foreground">
                            {ip}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <Check className="h-3.5 w-3.5 text-emerald-300" />
                              მხარდაჭერილი ვერსია: 1.21.3+
                            </span>
                            <span className="text-white/40">•</span>
                            <span>
                              ვერსია:{' '}
                              <span className="text-foreground/90 font-semibold">
                                {liveLoading ? 'იტვირთება...' : liveVersion ?? 'უცნობია'}
                              </span>
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          aria-label="IP დაკოპირება"
                          onClick={handleCopyIp}
                          className={[
                            'shrink-0 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold',
                            'bg-primary/20 text-primary ring-1 ring-primary/30',
                            'hover:bg-primary/25 transition-colors',
                          ].join(' ')}
                        >
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          <span className="hidden sm:inline">
                            {copied ? 'დაკოპირდა' : 'კოპირება'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-3 max-h-[min(44vh,320px)] overflow-y-auto pr-1">
                      {joinedSteps.map((s) => (
                        <div
                          key={s.key}
                          className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/7 transition-colors"
                        >
                          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white/90">
                            <s.icon className="h-4 w-4" />
                          </div>
                          <div className="text-sm md:text-[15px] text-foreground/90 font-semibold">
                            {s.text}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-7 flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={handleJoinAction}
                        aria-label="სერვერზე შესვლა"
                        className={[
                          'group inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 font-display font-extrabold',
                          'gradient-primary text-primary-foreground box-glow',
                          'hover:opacity-95 transition-all duration-300 hover:scale-[1.02] active:scale-[1.01]',
                        ].join(' ')}
                      >
                        <Rocket className="h-5 w-5" />
                        სერვერზე შესვლა
                      </button>

                      <button
                        type="button"
                        onClick={handleClose}
                        aria-label="დახურვა"
                        className={[
                          'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 font-display font-extrabold',
                          'border border-white/15 bg-white/5 text-foreground hover:bg-white/10',
                          'transition-colors',
                        ].join(' ')}
                      >
                        <X className="h-5 w-5" />
                        დახურვა
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="mt-5 hidden sm:block text-center text-xs text-white/60">
            პრემიუმ გზამკვლევი • RageMC Network
          </p>
        </div>
      </div>
    </div>
  );
}
