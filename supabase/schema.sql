CREATE TABLE IF NOT EXISTS businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  google_place_id TEXT,
  category TEXT DEFAULT 'restaurant',
  logo_url TEXT,
  welcome_message TEXT DEFAULT 'Thanks for visiting! Share your experience in 60 seconds.',
  city TEXT,
  area TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS highlight_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS review_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses ON DELETE CASCADE NOT NULL,
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  category_ratings JSONB DEFAULT '{}',
  selected_tags TEXT[] DEFAULT '{}',
  additional_comment TEXT,
  generated_review TEXT,
  status TEXT DEFAULT 'started',
  customer_contact TEXT,
  private_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlight_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own businesses" ON businesses;
CREATE POLICY "Users can view own businesses"
  ON businesses FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own businesses" ON businesses;
CREATE POLICY "Users can insert own businesses"
  ON businesses FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own businesses" ON businesses;
CREATE POLICY "Users can update own businesses"
  ON businesses FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own tags" ON highlight_tags;
CREATE POLICY "Users can manage own tags"
  ON highlight_tags FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage own menu items" ON menu_items;
CREATE POLICY "Users can manage own menu items"
  ON menu_items FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Anyone can create review sessions" ON review_sessions;
CREATE POLICY "Anyone can create review sessions"
  ON review_sessions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Business owners can view their sessions" ON review_sessions;
CREATE POLICY "Business owners can view their sessions"
  ON review_sessions FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- New columns for features
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS menu_urls TEXT[] DEFAULT '{}';
ALTER TABLE review_sessions ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE review_sessions ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Storage setup (Instructions for Supabase SQL Editor)
/*
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('menus', 'menus', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id IN ('logos', 'menu-images', 'menus'));

DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('logos', 'menu-images', 'menus') AND auth.role() = 'authenticated');
*/
