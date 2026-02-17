import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")?.trim();
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const DISCORD_WEBHOOK_URL = Deno.env.get("DISCORD_ORDERS_WEBHOOK_URL")?.trim();
const DISCORD_REDIRECT_URL =
  Deno.env.get("DISCORD_REDIRECT_URL")?.trim() ||
  "https://discord.gg/XfAK8GHDRY";
const DISCORD_ORDERS_MENTION = Deno.env.get("DISCORD_ORDERS_MENTION")?.trim();
const DISCORD_SHOP_NAME = Deno.env.get("DISCORD_SHOP_NAME")?.trim() || "RageMC Shop";
const ORDER_COOLDOWN_SECONDS = (() => {
  const raw = Deno.env.get("ORDER_COOLDOWN_SECONDS")?.trim();
  const parsed = raw ? Number(raw) : 60;
  if (!Number.isFinite(parsed)) return 60;
  return Math.max(0, Math.floor(parsed));
})();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

if (!SUPABASE_URL || !SUPABASE_KEY) {
  // Don't crash the function process; return a structured error from the handler.
  console.error("Missing Supabase URL or API key (anon or service role)");
} else if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "SUPABASE_SERVICE_ROLE_KEY is not set. Falling back to SUPABASE_ANON_KEY; some inserts/updates may be blocked by RLS.",
  );
}

const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_KEY ?? "", {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

type CartPayload = {
  productId: string;
  qty: number;
};

type CreateOrderPayload = {
  minecraftUsername: string;
  discordUsername: string;
  cart: CartPayload[];
  notes?: string | null;
};

const currencyLabel = "GEL";

class HttpError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const getBearerToken = (req: Request) => {
  const header = req.headers.get("Authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return header.split(" ")[1]?.trim() || null;
};

type ResolvedUser = {
  id: string;
  email: string | null;
};

const resolveUser = async (token: string | null): Promise<ResolvedUser | null> => {
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    console.debug("Unable to resolve user", error?.message ?? "no user");
    return null;
  }
  return {
    id: data.user.id,
    email: data.user.email ?? null,
  };
};

const validateCart = (cart: unknown): Map<string, number> => {
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new HttpError("Cart cannot be empty");
  }

  const normalized = new Map<string, number>();
  cart.forEach((item) => {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as CartPayload).productId !== "string"
    ) {
      throw new HttpError("Cart payload is malformed");
    }
    const payload = item as CartPayload;
    const productId = payload.productId.trim();
    if (!productId) {
      throw new HttpError("Cart items must include a productId");
    }

    const quantity = Number.isFinite(payload.qty) ? Math.max(1, Math.floor(payload.qty)) : 1;
    if (quantity <= 0) {
      throw new HttpError("Cart quantities must be greater than zero");
    }

    normalized.set(productId, (normalized.get(productId) ?? 0) + quantity);
  });

  if (normalized.size === 0) {
    throw new HttpError("Cart is empty");
  }

  return normalized;
};

const formatMoney = (value: number) => `${value.toFixed(2)} ${currencyLabel}`;

const getClientIp = (req: Request) => {
  const cfConnectingIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfConnectingIp) return cfConnectingIp;

  const xRealIp = req.headers.get("x-real-ip")?.trim();
  if (xRealIp) return xRealIp;

  const xForwardedFor = req.headers.get("x-forwarded-for")?.trim();
  if (xForwardedFor) return xForwardedFor.split(",")[0]?.trim() || null;

  const xClientIp = req.headers.get("x-client-ip")?.trim();
  if (xClientIp) return xClientIp;

  const flyClientIp = req.headers.get("fly-client-ip")?.trim();
  if (flyClientIp) return flyClientIp;

  return null;
};

const sha256Hex = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

type RecentOrder = {
  id: string;
  created_at: string;
};

const enforceCooldownBuckets = async (buckets: string[], cooldownSeconds: number) => {
  for (const bucket of buckets) {
    const { data, error } = await supabase.rpc("enforce_order_cooldown", {
      p_bucket: bucket,
      p_window_seconds: cooldownSeconds,
    });

    if (error) {
      return null;
    }

    const retryAfterSeconds = typeof data === "number" ? data : Number(data);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return Math.max(1, Math.floor(retryAfterSeconds));
    }
  }

  return 0;
};

const fetchRecentOrder = async (attempts: { column: string; value: string }[], sinceIso: string) => {
  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from("orders")
      .select("id, created_at")
      .eq(attempt.column, attempt.value)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      continue;
    }

    const row = Array.isArray(data) ? (data[0] as Partial<RecentOrder> | undefined) : undefined;
    if (row?.created_at) {
      return { id: String(row.id ?? ""), created_at: String(row.created_at) };
    }
  }

  return null;
};

const enforceOrderCooldown = async (input: {
  userId: string | null;
  clientIp: string | null;
  minecraftUsername: string;
  discordUsername: string;
  cooldownSeconds: number;
}) => {
  if (!Number.isFinite(input.cooldownSeconds) || input.cooldownSeconds <= 0) {
    return;
  }

  const normalizedDiscord = input.discordUsername.trim().toLowerCase();
  const normalizedMinecraft = input.minecraftUsername.trim().toLowerCase();
  const [discordHash, minecraftHash, ipHash] = await Promise.all([
    sha256Hex(normalizedDiscord),
    sha256Hex(normalizedMinecraft),
    input.clientIp ? sha256Hex(input.clientIp) : Promise.resolve(""),
  ]);

  const buckets = [
    ipHash ? `order:ip:${ipHash}` : null,
    input.userId ? `order:user:${input.userId}` : null,
    `order:discord:${discordHash}`,
    `order:minecraft:${minecraftHash}`,
  ].filter(Boolean) as string[];

  const retryAfterFromBuckets = await enforceCooldownBuckets(buckets, input.cooldownSeconds);
  if (retryAfterFromBuckets !== null) {
    if (retryAfterFromBuckets > 0) {
      throw new HttpError(
        `შეკვეთას ძალიან ხშირად აკეთებ. სცადე ისევ ${retryAfterFromBuckets} წამში.`,
        429,
      );
    }
    return;
  }

  const sinceIso = new Date(Date.now() - input.cooldownSeconds * 1000).toISOString();
  const attempts: { column: string; value: string }[] = [];

  if (input.userId) {
    attempts.push({ column: "user_id", value: input.userId });
  }

  attempts.push(
    { column: "discord_id", value: input.discordUsername },
    { column: "discord_username", value: input.discordUsername },
    { column: "minecraft_nickname", value: input.minecraftUsername },
    { column: "minecraft_username", value: input.minecraftUsername },
  );

  const recentOrder = await fetchRecentOrder(attempts, sinceIso);
  if (!recentOrder) {
    return;
  }

  const createdAtMs = Date.parse(recentOrder.created_at);
  const secondsAgo = Number.isFinite(createdAtMs)
    ? Math.max(0, Math.floor((Date.now() - createdAtMs) / 1000))
    : 0;
  const retryAfterSeconds = Math.max(1, input.cooldownSeconds - secondsAgo);

  throw new HttpError(
    `შეკვეთას ძალიან ხშირად აკეთებ. სცადე ისევ ${retryAfterSeconds} წამში.`,
    429,
  );
};

const insertOrder = async (payloads: Record<string, unknown>[]) => {
  let lastError: { message?: string } | null = null;

  for (const payload of payloads) {
    const { error } = await supabase.from("orders").insert(payload);
    if (!error) {
      return;
    }
    lastError = error;
  }

  throw new HttpError(lastError?.message || "Unable to create order", 500);
};

const logWebhookDelivery = async (payload: {
  orderId: string;
  url: string;
  responseCode: number;
  responseBody: string;
  success: boolean;
  payload: Record<string, unknown>;
}) => {
  await supabase.from("webhook_deliveries").insert({
    order_id: payload.orderId,
    url: payload.url,
    payload: payload.payload,
    response_code: payload.responseCode,
    response_body: payload.responseBody,
    success: payload.success,
  });
};

const sendDiscordNotification = async (payload: {
  orderId: string;
  minecraft: string;
  discord: string;
  email: string | null;
  userId: string | null;
  total: number;
  items: {
    name: string;
    quantity: number;
    subtotal: number;
    category: string | null;
    gamemode: string | null;
  }[];
  notes: string | null;
}) => {
  if (!DISCORD_WEBHOOK_URL) {
    throw new HttpError("Discord webhook is not configured", 500);
  }

  const truncateText = (value: string, maxLength: number) =>
    value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 3))}...` : value;

  const joinLinesWithinLimit = (lines: string[], maxLength: number) => {
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

  const shortId = payload.orderId.slice(0, 8);
  const timestamp = new Date().toISOString();

  const categoriesField = Array.from(
    new Set(payload.items.map((item) => item.category).filter(Boolean)),
  ).join(", ");
  const gamemodesField = Array.from(
    new Set(payload.items.map((item) => item.gamemode).filter(Boolean)),
  ).join(", ");

  const totalQuantity = payload.items.reduce((sum, item) => sum + item.quantity, 0);
  const distinctItems = payload.items.length;

  const itemsValue = payload.items.length
    ? joinLinesWithinLimit(
        payload.items.map((item) => {
          const meta = [item.category, item.gamemode].filter(Boolean).join(" / ");
          const metaSuffix = meta ? ` (${meta})` : "";
          return `• ${item.name} x${item.quantity} — ${formatMoney(item.subtotal)}${metaSuffix}`;
        }),
        1000,
      )
    : "პროდუქტები ვერ მოიძებნა";

  const userInfoLines = [
    `Discord: **${payload.discord}**`,
    `Minecraft: **${payload.minecraft}**`,
    ...(payload.email ? [`Email: **${payload.email}**`] : []),
    ...(payload.userId ? [`User ID: \`${payload.userId}\``] : []),
  ];

  const totalsLines = [
    `Subtotal: ${formatMoney(payload.total)}`,
    `საბოლოო თანხა: ${formatMoney(payload.total)}`,
    `ნივთები: ${totalQuantity} (${distinctItems} სახეობა)`,
  ];

  const statusLabel = "🟡 გადახდის მოლოდინში";

  const embed = {
    title: "🛒 ახალი შეკვეთა!",
    description: `შეკვეთა #${shortId} მიღებულია და ელოდება გადახდას.`,
    color: 0x57f287,
    timestamp,
    footer: {
      text: `${DISCORD_SHOP_NAME} • Order ID: ${shortId}`,
    },
    fields: [
      { name: "🆔 შეკვეთის ID", value: `\`${payload.orderId}\``, inline: false },
      { name: "👤 მომხმარებლის ინფორმაცია", value: userInfoLines.join("\n"), inline: false },
      { name: "📦 შეკვეთილი პროდუქტები", value: itemsValue, inline: false },
      { name: "💰 ჯამური თანხა", value: totalsLines.join("\n"), inline: true },
      { name: "📊 სტატუსი", value: statusLabel, inline: true },
      ...(categoriesField
        ? [{ name: "🏷️ კატეგორიები", value: categoriesField, inline: false }]
        : []),
      ...(gamemodesField
        ? [{ name: "🎮 გეიმმოდები", value: gamemodesField, inline: false }]
        : []),
      ...(payload.notes
        ? [
            {
              name: "📝 დამატებითი ინფორმაცია",
              value: truncateText(payload.notes, 1000),
            },
          ]
        : []),
    ],
  };

  const firstLine = DISCORD_ORDERS_MENTION
    ? `${DISCORD_ORDERS_MENTION} ახალი შეკვეთა მოვიდა!`
    : "🛒 ახალი შეკვეთა მოვიდა!";

  const body = {
    content: [firstLine, "", `📞 დაუკავშირდით მომხმარებელს: **${payload.discord}**`].join(
      "\n",
    ),
    allowed_mentions: DISCORD_ORDERS_MENTION ? { parse: ["roles"] } : { parse: [] },
    embeds: [embed],
  };
  const res = await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  await logWebhookDelivery({
    orderId: payload.orderId,
    // Never persist the actual webhook URL outside of Edge Function secrets.
    url: "DISCORD_ORDERS_WEBHOOK_URL",
    responseCode: res.status,
    responseBody: text,
    success: res.ok,
    payload: body,
  });

  if (!res.ok) {
    throw new HttpError(
      `Discord webhook failed (${res.status}): ${text || res.statusText}`,
      500,
    );
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        Allow: "POST",
        ...corsHeaders,
      },
    });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new HttpError("Server is missing Supabase configuration", 500);
    }

    const payload = (await req.json()) as CreateOrderPayload;
    const minecraftUsername = payload.minecraftUsername?.trim();
    const discordUsername = payload.discordUsername?.trim();
    const notes =
      typeof payload.notes === "string" && payload.notes.trim().length > 0
        ? payload.notes.trim()
        : null;

    if (!minecraftUsername) {
      throw new HttpError("Minecraft username is required");
    }
    if (!discordUsername) {
      throw new HttpError("Discord username is required");
    }

    const cartMap = validateCart(payload.cart);

    const resolvedUser = await resolveUser(getBearerToken(req));
    const userId = resolvedUser?.id ?? null;
    const userEmail = resolvedUser?.email ?? null;
    const clientIp = getClientIp(req);

    try {
      await enforceOrderCooldown({
        userId,
        clientIp,
        minecraftUsername,
        discordUsername,
        cooldownSeconds: ORDER_COOLDOWN_SECONDS,
      });
    } catch (cooldownError) {
      if (cooldownError instanceof HttpError) {
        throw cooldownError;
      }
      console.warn("Cooldown enforcement failed; continuing without rate limit", cooldownError);
    }

    const productIds = Array.from(cartMap.keys());
    const { data: products, error: productError } = await supabase
      .from("shop_items")
      .select("id, name, price, category_id, gamemode_id")
      .in("id", productIds);

    if (productError) {
      throw new HttpError(productError.message, 500);
    }

    if (!products || products.length === 0) {
      throw new HttpError("One or more cart items are invalid");
    }

    const productMap = new Map(products.map((product) => [product.id, product]));

    const categoryIds = Array.from(
      new Set(
        products
          .map((product) => (product as { category_id: string | null }).category_id)
          .filter(Boolean),
      ),
    );
    const gamemodeIds = Array.from(
      new Set(
        products
          .map((product) => (product as { gamemode_id: string | null }).gamemode_id)
          .filter(Boolean),
      ),
    );

    let categoryMap = new Map<string, string>();
    if (categoryIds.length > 0) {
      const { data: categories, error: categoriesError } = await supabase
        .from("categories")
        .select("id, name")
        .in("id", categoryIds);

      if (categoriesError) {
        throw new HttpError(categoriesError.message, 500);
      }

      categoryMap = new Map(
        (categories ?? []).map((category) => [category.id, category.name]),
      );
    }

    let gamemodeMap = new Map<string, string>();
    if (gamemodeIds.length > 0) {
      const { data: gamemodes, error: gamemodesError } = await supabase
        .from("gamemodes")
        .select("id, name")
        .in("id", gamemodeIds);

      if (gamemodesError) {
        throw new HttpError(gamemodesError.message, 500);
      }

      gamemodeMap = new Map(
        (gamemodes ?? []).map((gamemode) => [gamemode.id, gamemode.name]),
      );
    }
    const items: {
      id: string;
      name: string;
      price: number;
      quantity: number;
      subtotal: number;
      category: string | null;
      gamemode: string | null;
    }[] = [];

    let total = 0;
    for (const [productId, quantity] of cartMap.entries()) {
      const product = productMap.get(productId);
      if (!product) {
        throw new HttpError(`Product ${productId} not found`);
      }

      const rawPrice = (product as { price: unknown }).price;
      const price = typeof rawPrice === "number" ? rawPrice : Number(rawPrice);
      if (!Number.isFinite(price)) {
        throw new HttpError(`Invalid price for product ${productId}`, 500);
      }

      const categoryId = (product as { category_id: string | null }).category_id;
      const gamemodeId = (product as { gamemode_id: string | null }).gamemode_id;
      const categoryName = categoryId ? categoryMap.get(categoryId) ?? null : null;
      const gamemodeName = gamemodeId ? gamemodeMap.get(gamemodeId) ?? null : null;

      const subtotal = price * quantity;
      total += subtotal;
      items.push({
        id: product.id,
        name: product.name,
        price,
        quantity,
        subtotal,
        category: categoryName,
        gamemode: gamemodeName,
      });
    }
    const orderId = crypto.randomUUID();

    await insertOrder([
      {
        id: orderId,
        user_id: userId,
        discord_id: discordUsername,
        minecraft_nickname: minecraftUsername,
        subtotal: total,
        total_amount: total,
        total,
        discount_amount: 0,
        status: "pending",
      },
      {
        id: orderId,
        user_id: userId,
        discord_id: discordUsername,
        minecraft_nickname: minecraftUsername,
        subtotal: total,
        total_amount: total,
        discount_amount: 0,
        status: "pending",
      },
      {
        id: orderId,
        user_id: userId,
        discord_username: discordUsername,
        minecraft_username: minecraftUsername,
        subtotal: total,
        total_amount: total,
        total,
        discount_amount: 0,
        status: "pending",
      },
      {
        id: orderId,
        user_id: userId,
        discord_username: discordUsername,
        minecraft_username: minecraftUsername,
        subtotal: total,
        total_amount: total,
        discount_amount: 0,
        status: "pending",
      },
      {
        id: orderId,
        user_id: userId,
        discord_username: discordUsername,
        minecraft_username: minecraftUsername,
        total,
        status: "pending",
      },
    ]);

    const orderItems = items.map((item) => ({
      order_id: orderId,
      item_name: item.name,
      item_price: item.price,
      quantity: item.quantity,
    }));

    const { error: orderItemError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (orderItemError) {
      throw new HttpError(orderItemError.message, 500);
    }

    if (DISCORD_WEBHOOK_URL) {
      try {
        await sendDiscordNotification({
          orderId,
          minecraft: minecraftUsername,
          discord: discordUsername,
          email: userEmail,
          userId,
          total,
          items,
          notes,
        });
      } catch (notificationError) {
        console.error("Discord notification failed:", notificationError);
      }
    } else {
      console.warn(
        "DISCORD_ORDERS_WEBHOOK_URL is not set; skipping Discord notification.",
      );
    }

    return new Response(
      JSON.stringify({
        orderId,
        redirectUrl: DISCORD_REDIRECT_URL,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  } catch (error) {
    console.error("create-order failed:", error);
    const message =
      error instanceof HttpError ? error.message : "Unexpected error";
    const status = error instanceof HttpError ? error.status : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
});
