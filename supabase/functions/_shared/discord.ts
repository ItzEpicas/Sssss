export type DiscordPostResult = {
  ok: boolean;
  status: number;
  text: string;
};

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.floor(ms))));

export const truncateText = (value: string, maxLength: number) => {
  const normalized = value ?? "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
};

export const joinLinesWithinLimit = (lines: string[], maxLength: number) => {
  let out = "";
  for (const line of lines) {
    const next = out ? `${out}\n${line}` : line;
    if (next.length > maxLength) {
      if (!out) return truncateText(line, maxLength);
      const suffix = "\n...";
      return out.length + suffix.length <= maxLength ? `${out}${suffix}` : truncateText(out, maxLength);
    }
    out = next;
  }
  return out;
};

export async function postDiscordWebhookWithRetry(
  webhookUrl: string,
  body: Record<string, unknown>,
  options?: { attempts?: number; baseDelayMs?: number; maxDelayMs?: number },
): Promise<DiscordPostResult> {
  const attempts = Math.max(1, Math.floor(options?.attempts ?? 3));
  const baseDelayMs = Math.max(0, Math.floor(options?.baseDelayMs ?? 600));
  const maxDelayMs = Math.max(baseDelayMs, Math.floor(options?.maxDelayMs ?? 8_000));

  let lastStatus = 0;
  let lastText = "";
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      lastStatus = res.status;
      lastText = text;

      if (res.ok) {
        return { ok: true, status: res.status, text };
      }

      lastError = new Error(`Discord webhook failed: ${res.status}`);
    } catch (error) {
      lastError = error;
      lastStatus = 0;
      lastText = error instanceof Error ? error.message : String(error);
    }

    if (attempt < attempts) {
      const expo = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
      const jitter = Math.floor(Math.random() * 120);
      await sleep(expo + jitter);
    }
  }

  console.error("Discord webhook failed after retries:", lastError);
  return { ok: false, status: lastStatus, text: lastText };
}

