import { supabase } from "@/integrations/supabase/client";

type EdgeCallOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

export class EdgeFunctionError extends Error {
  status: number;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function callEdgeFunction<TResponse>(
  path: string,
  options: EdgeCallOptions = {},
): Promise<TResponse> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new EdgeFunctionError("Not authenticated", 401);
  }

  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!baseUrl) {
    throw new EdgeFunctionError("Missing VITE_SUPABASE_URL", 500);
  }

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!anonKey) {
    throw new EdgeFunctionError("Missing VITE_SUPABASE_ANON_KEY", 500);
  }

  const normalizedPath = path.replace(/^\/+/, "");
  const url = import.meta.env.DEV
    ? `/functions/v1/${normalizedPath}`
    : `${baseUrl.replace(/\/$/, "")}/functions/v1/${normalizedPath}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    apikey: anonKey,
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    if (res.status === 404) {
      const functionName = normalizedPath.split(/[/?]/)[0] || normalizedPath;
      const hint = import.meta.env.DEV
        ? "Make sure the Edge Function is deployed (or run it locally) and restart the dev server so the Vite proxy is applied."
        : "Make sure the Edge Function is deployed.";
      throw new EdgeFunctionError(`Edge Function "${functionName}" not found. ${hint}`, 404);
    }

    const message = (() => {
      if (typeof payload === "object" && payload !== null) {
        const maybe = payload as { error?: unknown };
        if (typeof maybe.error === "string") return maybe.error;
      }
      if (typeof payload === "string" && payload.trim()) return payload;
      return res.statusText;
    })();

    const retryAfterSeconds =
      typeof payload === "object" &&
      payload !== null &&
      typeof (payload as { retryAfterSeconds?: unknown }).retryAfterSeconds ===
        "number"
        ? (payload as { retryAfterSeconds: number }).retryAfterSeconds
        : undefined;

    throw new EdgeFunctionError(message, res.status, retryAfterSeconds);
  }

  return payload as TResponse;
}
