-- Full Supabase schema for Georgian Craft Hub shop + admin
-- Includes roles, products, orders, tickets, giveaways, banners, settings, logging, webhook deliveries, gizmos

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE t.typname = 'app_role' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.app_role AS ENUM (
      'owner',
      'manager',
      'admin',
      'support',
      'moder',
      'helper',
      'user'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Profiles mirror Supabase auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  bio TEXT,
  discord_id TEXT,
  minecraft_nickname TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User role pivot
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Gamemodes
CREATE TABLE IF NOT EXISTS public.gamemodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products / shop items
CREATE TABLE IF NOT EXISTS public.shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gamemode_id UUID REFERENCES public.gamemodes(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  original_price NUMERIC(10,2),
  image_url TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_items_active ON public.shop_items (is_active, is_featured);

-- Orders & items
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  minecraft_username TEXT NOT NULL,
  discord_username TEXT NOT NULL,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  promo_code TEXT,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  discord_notified_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders (user_id);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  shop_item_id UUID REFERENCES public.shop_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  item_price NUMERIC(10,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Promo codes
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_percent INT CHECK (discount_percent BETWEEN 0 AND 100),
  discount_amount NUMERIC(10,2),
  max_uses INT,
  current_uses INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_active ON public.promo_codes (code) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.promo_code_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tickets
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  is_staff BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Giveaways
CREATE TABLE IF NOT EXISTS public.giveaways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.giveaway_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL REFERENCES public.giveaways(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  minecraft_username TEXT,
  discord_username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (giveaway_id, user_id)
);

-- Banners
CREATE TABLE IF NOT EXISTS public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  image_url TEXT,
  link_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Site settings
CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Webhook deliveries (for auditing)
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  payload JSONB,
  response_code INT,
  response_body TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_order ON public.webhook_deliveries (order_id);

-- Activity log
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, minecraft_nickname)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'minecraft_nickname');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'manager', 'admin', 'support', 'moder', 'helper')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'manager', 'admin')
  );
$$;

-- Triggers
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gamemodes_updated_at
BEFORE UPDATE ON public.gamemodes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shop_items_updated_at
BEFORE UPDATE ON public.shop_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_banners_updated_at
BEFORE UPDATE ON public.banners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamemodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Policies applied below

DROP POLICY IF EXISTS "Profiles select own or staff" ON public.profiles;
CREATE POLICY "Profiles select own or staff" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Profiles insert own" ON public.profiles;
CREATE POLICY "Profiles insert own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
CREATE POLICY "Profiles update own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "User roles viewable by staff" ON public.user_roles;
CREATE POLICY "User roles viewable by staff" ON public.user_roles
  FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR UPDATE USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Gamemodes are viewable by everyone" ON public.gamemodes;
CREATE POLICY "Gamemodes are viewable by everyone" ON public.gamemodes
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage gamemodes" ON public.gamemodes;
CREATE POLICY "Admins can manage gamemodes" ON public.gamemodes
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
CREATE POLICY "Categories are viewable by everyone" ON public.categories
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories" ON public.categories
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Shop items are viewable when active" ON public.shop_items;
CREATE POLICY "Shop items are viewable when active" ON public.shop_items
  FOR SELECT USING (is_active OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Admins can manage shop items" ON public.shop_items;
CREATE POLICY "Admins can manage shop items" ON public.shop_items
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders" ON public.orders
  FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
CREATE POLICY "Staff can update orders" ON public.orders
  FOR UPDATE USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff can delete orders" ON public.orders;
CREATE POLICY "Staff can delete orders" ON public.orders
  FOR DELETE USING (public.is_staff(auth.uid()));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_items'
      AND column_name = 'order_id'
  ) THEN
    EXECUTE $$
      DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
      CREATE POLICY "Users can view own order items" ON public.order_items
        FOR SELECT USING (
          EXISTS (
            SELECT 1
            FROM public.orders
            WHERE orders.id = order_id
              AND (orders.user_id = auth.uid() OR public.is_staff(auth.uid()))
          )
        );
      DROP POLICY IF EXISTS "Any insert for order items" ON public.order_items;
      CREATE POLICY "Any insert for order items" ON public.order_items
        FOR INSERT WITH CHECK (true);
      DROP POLICY IF EXISTS "Staff can mutate order items" ON public.order_items;
      CREATE POLICY "Staff can mutate order items" ON public.order_items
        FOR ALL USING (public.is_staff(auth.uid()));
    $$;
  END IF;
END;
$$;

DROP POLICY IF EXISTS "Active promo codes viewable" ON public.promo_codes;
CREATE POLICY "Active promo codes viewable" ON public.promo_codes
  FOR SELECT USING (is_active OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins can manage promo codes" ON public.promo_codes;
CREATE POLICY "Admins can manage promo codes" ON public.promo_codes
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Staff can view promo usage" ON public.promo_code_usages;
CREATE POLICY "Staff can view promo usage" ON public.promo_code_usages
  FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Admins can manage promo usage" ON public.promo_code_usages;
CREATE POLICY "Admins can manage promo usage" ON public.promo_code_usages
  FOR ALL USING (public.is_staff(auth.uid()) OR public.is_admin(auth.uid())) WITH CHECK (public.is_staff(auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view own tickets" ON public.tickets;
CREATE POLICY "Users can view own tickets" ON public.tickets
  FOR SELECT USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Users can insert tickets" ON public.tickets;
CREATE POLICY "Users can insert tickets" ON public.tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Staff can update/delete tickets" ON public.tickets;
CREATE POLICY "Staff can update/delete tickets" ON public.tickets
  FOR ALL USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Users can view own ticket messages" ON public.ticket_messages;
CREATE POLICY "Users can view own ticket messages" ON public.ticket_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.tickets
      WHERE tickets.id = ticket_messages.ticket_id
        AND (tickets.user_id = auth.uid() OR public.is_staff(auth.uid()))
    )
  );
DROP POLICY IF EXISTS "Users can create messages on own tickets" ON public.ticket_messages;
CREATE POLICY "Users can create messages on own tickets" ON public.ticket_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tickets
      WHERE tickets.id = ticket_messages.ticket_id
        AND (tickets.user_id = auth.uid() OR public.is_staff(auth.uid()))
    )
  );
DROP POLICY IF EXISTS "Staff can manage ticket messages" ON public.ticket_messages;
CREATE POLICY "Staff can manage ticket messages (update)" ON public.ticket_messages
  FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can manage ticket messages (delete)" ON public.ticket_messages
  FOR DELETE USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Active giveaways viewable" ON public.giveaways;
CREATE POLICY "Active giveaways viewable" ON public.giveaways
  FOR SELECT USING (is_active OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff can manage giveaways" ON public.giveaways;
CREATE POLICY "Staff can manage giveaways" ON public.giveaways
  FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Users can view own giveaway entries" ON public.giveaway_entries;
CREATE POLICY "Users can view own giveaway entries" ON public.giveaway_entries
  FOR SELECT USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Users can insert their giveaway entry" ON public.giveaway_entries;
CREATE POLICY "Users can insert their giveaway entry" ON public.giveaway_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Staff can adjust entries" ON public.giveaway_entries;
CREATE POLICY "Staff can adjust entries (update)" ON public.giveaway_entries
  FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can adjust entries (delete)" ON public.giveaway_entries
  FOR DELETE USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Active banners viewable" ON public.banners;
CREATE POLICY "Active banners viewable" ON public.banners
  FOR SELECT USING (is_active OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Admins manage banners" ON public.banners;
CREATE POLICY "Admins manage banners" ON public.banners
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Site settings viewable by everyone" ON public.site_settings;
CREATE POLICY "Site settings viewable by everyone" ON public.site_settings
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage site settings" ON public.site_settings;
CREATE POLICY "Admins manage site settings" ON public.site_settings
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Staff can view webhook deliveries" ON public.webhook_deliveries;
CREATE POLICY "Staff can view webhook deliveries" ON public.webhook_deliveries
  FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff can manage webhook deliveries" ON public.webhook_deliveries;
CREATE POLICY "Staff can manage webhook deliveries" ON public.webhook_deliveries
  FOR ALL USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can view activity logs" ON public.activity_logs;
CREATE POLICY "Staff can view activity logs" ON public.activity_logs
  FOR SELECT USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff can create activity logs" ON public.activity_logs;
CREATE POLICY "Staff can create activity logs" ON public.activity_logs
  FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
