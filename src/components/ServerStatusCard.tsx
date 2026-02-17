import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ServerStatusCardProps = {
  ip?: string;
  title?: string;
};

type StatusSource = 'mcsrvstat' | 'mcapi';

type ServerStatus = {
  online: boolean;
  playersOnline: number | null;
  playersMax: number | null;
  version: string | null;
  motd: string | null;
  source: StatusSource;
  fetchedAt: number;
};

const DEFAULT_IP = 'play.ragemc.ge';
const DEFAULT_TITLE = 'RageMC';

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

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const fetchMcsrvstat = async (
  ip: string,
  signal: AbortSignal,
): Promise<Omit<ServerStatus, 'fetchedAt'>> => {
  if (!import.meta.env.DEV) {
    throw new Error('mcsrvstat disabled');
  }
  const url = `/api/mcsrvstat/3/${encodeURIComponent(ip)}`;
  const res = await fetch(url, { method: 'GET', signal, cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`mcsrvstat.us responded with ${res.status}`);
  }
  const json: unknown = await res.json();
  const data =
    typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {};
  const playersRaw = data.players;
  const players =
    typeof playersRaw === 'object' && playersRaw !== null
      ? (playersRaw as Record<string, unknown>)
      : {};
  const motdRaw = data.motd;
  const motd =
    typeof motdRaw === 'object' && motdRaw !== null
      ? (motdRaw as Record<string, unknown>)
      : {};

  const online = Boolean(data.online);
  const playersOnline = toNumberOrNull(players.online);
  const playersMax = toNumberOrNull(players.max);
  const version =
    typeof data.version === 'string' && data.version.trim()
      ? (data.version as string).trim()
      : null;
  const motdLine = coerceFirstLine(motd.clean);

  return {
    online,
    playersOnline,
    playersMax,
    version,
    motd: motdLine,
    source: 'mcsrvstat',
  };
};

const fetchMcapi = async (
  ip: string,
  signal: AbortSignal,
): Promise<Omit<ServerStatus, 'fetchedAt'>> => {
  const url = `https://mcapi.us/server/status?ip=${encodeURIComponent(ip)}`;
  const res = await fetch(url, { method: 'GET', signal, cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`mcapi.us responded with ${res.status}`);
  }
  const json: unknown = await res.json();
  const data =
    typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {};
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

  const online = Boolean(data.online);
  const playersOnline = toNumberOrNull(players.now ?? players.online);
  const playersMax = toNumberOrNull(players.max);

  const serverName =
    typeof server.name === 'string' ? (server.name as string).trim() : '';
  const version = serverName ? serverName : null;

  const motdLine = coerceFirstLine(data.motd);

  return {
    online,
    playersOnline,
    playersMax,
    version,
    motd: motdLine,
    source: 'mcapi',
  };
};

const RefreshIcon = ({ spinning }: { spinning: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={`h-4 w-4 ${spinning ? 'animate-spin' : ''}`}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v7h-7" />
  </svg>
);

const CopyIcon = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const StatusDot = ({
  tone,
  pulsing,
}: {
  tone: 'online' | 'offline' | 'checking';
  pulsing: boolean;
}) => {
  const color =
    tone === 'checking'
      ? 'bg-sky-300'
      : tone === 'online'
        ? 'bg-emerald-400'
        : 'bg-rose-400';
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span
        className={[
          'absolute inline-flex h-full w-full rounded-full opacity-60',
          pulsing ? 'animate-ping' : '',
          color,
        ].join(' ')}
      />
      <span
        className={[
          'relative inline-flex h-2.5 w-2.5 rounded-full',
          color,
        ].join(' ')}
      />
    </span>
  );
};

export default function ServerStatusCard({
  ip = DEFAULT_IP,
  title = DEFAULT_TITLE,
}: ServerStatusCardProps) {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mountedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const copiedTimeoutRef = useRef<number | null>(null);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (copiedTimeoutRef.current) {
        window.clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const refresh = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (mountedRef.current) {
      setIsLoading(true);
      setErrorMessage(null);
    }

    const now = Date.now();
    const applyResult = (result: Omit<ServerStatus, 'fetchedAt'>) => {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setStatus({ ...result, fetchedAt: now });
    };

    try {
      const primary = await fetchMcsrvstat(ip, controller.signal);
      applyResult(primary);
    } catch {
      if (controller.signal.aborted) return;
      try {
        const fallback = await fetchMcapi(ip, controller.signal);
        applyResult(fallback);
      } catch {
        if (controller.signal.aborted) return;
        if (!mountedRef.current || requestId !== requestIdRef.current) return;
        setStatus({
          online: false,
          playersOnline: null,
          playersMax: null,
          version: null,
          motd: null,
          source: 'mcsrvstat',
          fetchedAt: now,
        });
        setErrorMessage('Server is offline or status API is unreachable.');
      }
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    }
  }, [ip]);

  useEffect(() => {
    refresh();
    const intervalId = window.setInterval(() => {
      refresh();
    }, 30_000);
    return () => window.clearInterval(intervalId);
  }, [refresh]);

  const online = Boolean(status?.online);
  const isChecking = !status && isLoading;
  const tone: 'online' | 'offline' | 'checking' = isChecking
    ? 'checking'
    : online
      ? 'online'
      : 'offline';
  const statusLabel = useMemo(() => {
    if (isChecking) return 'CHECKING';
    return online ? 'ONLINE' : 'OFFLINE';
  }, [isChecking, online]);

  const playersOnline = status?.playersOnline ?? 0;
  const playersMax = status?.playersMax;
  const versionLabel = isChecking
    ? 'Loading...'
    : status?.version?.trim()
      ? status.version.trim()
      : 'Unknown';
  const motdLine = status?.motd?.trim() ? status.motd.trim() : null;

  const glowClass =
    tone === 'checking'
      ? 'from-sky-500/25 via-indigo-500/10 to-transparent'
      : tone === 'online'
        ? 'from-emerald-500/25 via-cyan-500/10 to-transparent'
        : 'from-rose-500/25 via-orange-500/10 to-transparent';

  const badgeClass = isChecking
    ? 'bg-white/10 text-white/80 ring-white/15'
    : online
      ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
      : 'bg-rose-500/15 text-rose-200 ring-rose-500/30';

  const handleCopy = useCallback(async () => {
    const showCopied = () => {
      if (!mountedRef.current) return;
      setCopied(true);
      if (copiedTimeoutRef.current) {
        window.clearTimeout(copiedTimeoutRef.current);
      }
      copiedTimeoutRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        setCopied(false);
      }, 1500);
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
  }, [ip]);

  return (
    <div className="relative">
      <div
        className={[
          'absolute -inset-0.5 rounded-2xl blur-xl opacity-70',
          'bg-gradient-to-r',
          glowClass,
          isLoading ? 'animate-pulse' : '',
        ].join(' ')}
      />

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04)] sm:p-5 md:p-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          {/* Left: Icon + Title + Status */}
          <div className="flex items-start gap-4">
            <div className="relative h-11 w-11 shrink-0">
              <div
                className={[
                  'absolute -inset-1 rounded-2xl blur-md opacity-80',
                  tone === 'checking'
                    ? 'bg-[conic-gradient(from_180deg_at_50%_50%,rgba(56,189,248,0.9),rgba(99,102,241,0.18),rgba(56,189,248,0.9))]'
                    : tone === 'online'
                      ? 'bg-[conic-gradient(from_180deg_at_50%_50%,rgba(16,185,129,0.9),rgba(34,211,238,0.15),rgba(16,185,129,0.9))]'
                      : 'bg-[conic-gradient(from_180deg_at_50%_50%,rgba(244,63,94,0.9),rgba(251,146,60,0.15),rgba(244,63,94,0.9))]',
                  isLoading ? 'animate-spin' : '',
                ].join(' ')}
              />
              <div className="absolute inset-0 rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-white/0" />
              <img
                src="/favicon.png"
                alt={title}
                className="relative h-11 w-11 rounded-xl object-cover"
              />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-display text-lg font-bold tracking-tight text-foreground">
                  {title}
                </h3>
                <span
                  className={[
                    'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1',
                    badgeClass,
                  ].join(' ')}
                >
                  <StatusDot tone={tone} pulsing={isLoading} />
                  <span className="tracking-wide">{statusLabel}</span>
                </span>
              </div>

              <div className="mt-2 space-y-1">
                <p className="truncate font-mono text-sm text-muted-foreground">
                  {ip}
                </p>
                <p className="text-xs text-muted-foreground">
                  Version:{' '}
                  <span className="text-foreground/90">{versionLabel}</span>
                </p>
                {motdLine && online && (
                  <p className="truncate text-xs text-muted-foreground">
                    {motdLine}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Middle: Players */}
          <div className="flex items-end justify-between gap-6 md:justify-center md:text-center">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Players Online
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tight text-foreground sm:text-4xl 2xl:text-5xl">
                  {isChecking ? '--' : online ? playersOnline : 0}
                </span>
                <span className="text-sm font-semibold text-muted-foreground">
                  / {isChecking ? '--' : playersMax ?? '--'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
            <button
              type="button"
              onClick={refresh}
              disabled={isLoading}
              aria-label="Refresh server status"
              className={[
                'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
                'border border-white/10 bg-white/5 text-foreground hover:bg-white/10',
                'disabled:cursor-not-allowed disabled:opacity-60',
              ].join(' ')}
            >
              <RefreshIcon spinning={isLoading} />
              <span>{status ? (online ? 'Refresh' : 'Retry') : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy server IP"
              className={[
                'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
                'bg-primary/20 text-primary hover:bg-primary/25 ring-1 ring-primary/30',
              ].join(' ')}
            >
              <CopyIcon />
              <span>{copied ? 'Copied!' : 'Copy IP'}</span>
            </button>
          </div>
        </div>

        {(errorMessage || (!online && status && !isLoading)) && (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground/90">Status:</span>{' '}
            {errorMessage ?? 'Server is currently offline.'}
          </div>
        )}
      </div>
    </div>
  );
}
