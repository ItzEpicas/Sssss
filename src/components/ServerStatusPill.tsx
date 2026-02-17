import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Users, Wifi, WifiOff } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type ServerStatusPillProps = {
  ip?: string;
  className?: string;
};

type Status = {
  online: boolean;
  playersOnline: number | null;
  playersMax: number | null;
};

const DEFAULT_IP = 'play.ragemc.ge';

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const fetchStatus = async (ip: string, signal: AbortSignal): Promise<Status> => {
  const primaryUrl = `/api/mcsrvstat/3/${encodeURIComponent(ip)}`;
  const fallbackUrl = `https://mcapi.us/server/status?ip=${encodeURIComponent(ip)}`;

  const fetchPrimary = async () => {
    if (!import.meta.env.DEV) throw new Error('Primary disabled');
    const res = await fetch(primaryUrl, { method: 'GET', signal, cache: 'no-store' });
    if (!res.ok) throw new Error('Primary failed');
    const json: unknown = await res.json();
    const data =
      typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {};
    const playersRaw = data.players;
    const players =
      typeof playersRaw === 'object' && playersRaw !== null
        ? (playersRaw as Record<string, unknown>)
        : {};

    return {
      online: Boolean(data.online),
      playersOnline: toNumberOrNull(players.online),
      playersMax: toNumberOrNull(players.max),
    };
  };

  const fetchFallback = async () => {
    const res = await fetch(fallbackUrl, { method: 'GET', signal, cache: 'no-store' });
    if (!res.ok) throw new Error('Fallback failed');
    const json: unknown = await res.json();
    const data =
      typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {};
    const playersRaw = data.players;
    const players =
      typeof playersRaw === 'object' && playersRaw !== null
        ? (playersRaw as Record<string, unknown>)
        : {};

    return {
      online: Boolean(data.online),
      playersOnline: toNumberOrNull(players.now ?? players.online),
      playersMax: toNumberOrNull(players.max),
    };
  };

  try {
    return await fetchPrimary();
  } catch {
    return await fetchFallback();
  }
};

export default function ServerStatusPill({
  ip = DEFAULT_IP,
  className = '',
}: ServerStatusPillProps) {
  const { language, t } = useLanguage();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let intervalId: number | null = null;

    const load = async () => {
      if (controller.signal.aborted) return;
      setLoading(true);
      try {
        const result = await fetchStatus(ip, controller.signal);
        if (controller.signal.aborted) return;
        setStatus(result);
      } catch {
        if (controller.signal.aborted) return;
        setStatus({ online: false, playersOnline: null, playersMax: null });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    load();
    intervalId = window.setInterval(load, 30_000);

    return () => {
      controller.abort();
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [ip]);

  const online = Boolean(status?.online);

  const playersLabel = useMemo(() => {
    if (!status || status.playersOnline == null || status.playersMax == null) return '--/--';
    return `${status.playersOnline}/${status.playersMax}`;
  }, [status]);

  const tone: 'checking' | 'online' | 'offline' = loading
    ? 'checking'
    : online
      ? 'online'
      : 'offline';

  const statusLabel = loading
    ? language === 'ka'
      ? 'ამოწმებს...'
      : 'Checking...'
    : online
      ? t('hero.online')
      : t('hero.offline');

  const pillClass =
    tone === 'checking'
      ? 'border-sky-400/20 bg-white/5 text-foreground shadow-[0_0_30px_rgba(56,189,248,0.15)]'
      : tone === 'online'
        ? 'border-emerald-400/20 bg-white/5 text-foreground shadow-[0_0_30px_rgba(16,185,129,0.14)]'
        : 'border-rose-400/20 bg-white/5 text-foreground shadow-[0_0_30px_rgba(244,63,94,0.12)]';

  const statusTextClass =
    tone === 'checking'
      ? 'text-sky-200'
      : tone === 'online'
        ? 'text-emerald-200'
        : 'text-rose-200';

  return (
    <div
      className={[
        'inline-flex items-center gap-3 rounded-full border px-4 py-2',
        'backdrop-blur-md',
        'text-xs sm:text-sm font-semibold',
        pillClass,
        className,
      ].join(' ')}
      aria-label={language === 'ka' ? 'სერვერის სტატუსი' : 'Server status'}
    >
      <span className="inline-flex items-center gap-2">
        {tone === 'checking' ? (
          <Loader2 className="h-4 w-4 animate-spin text-sky-200" />
        ) : tone === 'online' ? (
          <Wifi className="h-4 w-4 text-emerald-200" />
        ) : (
          <WifiOff className="h-4 w-4 text-rose-200" />
        )}
        <span className={statusTextClass}>{statusLabel}</span>
      </span>

      <span className="h-4 w-px bg-white/10" aria-hidden="true" />

      <span className="inline-flex items-center gap-2 text-foreground/90">
        <Users className="h-4 w-4 text-cyan-200" />
        <span className="font-mono">{playersLabel}</span>
      </span>
    </div>
  );
}
