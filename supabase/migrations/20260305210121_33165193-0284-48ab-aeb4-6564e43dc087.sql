
-- Role system
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are publicly readable" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  old_price NUMERIC(10,2),
  discount INT,
  image_url TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  tag TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are publicly readable" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Store settings (logo, banner text, etc)
CREATE TABLE public.store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings are publicly readable" ON public.store_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.store_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_settings_updated_at
  BEFORE UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for product images and logo
INSERT INTO storage.buckets (id, name, public) VALUES ('store-assets', 'store-assets', true);

CREATE POLICY "Store assets are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'store-assets');
CREATE POLICY "Admins can upload store assets" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'store-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update store assets" ON storage.objects
  FOR UPDATE USING (bucket_id = 'store-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete store assets" ON storage.objects
  FOR DELETE USING (bucket_id = 'store-assets' AND public.has_role(auth.uid(), 'admin'));

-- Insert default store settings
INSERT INTO public.store_settings (key, value) VALUES
  ('store_name', 'Campo Limpo Roleplay'),
  ('banner_text', 'Novos pacotes e recompensas exclusivas! Aproveite os descontos de inauguração 🎉'),
  ('hero_title', 'Campo Limpo Roleplay'),
  ('hero_subtitle', 'O RP tema São Paulo do momento!'),
  ('logo_url', '');

-- Insert default categories
INSERT INTO public.categories (name, slug, sort_order) VALUES
  ('Exclusivo do Mês', 'exclusivo-do-mes', 1),
  ('Blindados', 'blindados', 2),
  ('Luxo', 'luxo', 3),
  ('Cordões', 'cordoes', 4),
  ('Combos', 'combos', 5),
  ('Gemas', 'gemas', 6),
  ('Doações VIPs', 'doacoes-vips', 7),
  ('Ilegal', 'ilegal', 8),
  ('Exclusivos', 'exclusivos', 9),
  ('Condomínios', 'condominios', 10),
  ('Extras', 'extras', 11);
