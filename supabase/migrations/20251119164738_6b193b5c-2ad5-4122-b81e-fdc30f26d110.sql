-- Create storage buckets for photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]),
  ('banners', 'banners', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]),
  ('service-images', 'service-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for avatars bucket
CREATE POLICY "Avatars são públicos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Barbeiros podem fazer upload de avatares"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Barbeiros podem atualizar seus avatares"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Barbeiros podem deletar seus avatares"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS policies for banners bucket
CREATE POLICY "Banners são públicos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'banners');

CREATE POLICY "Barbeiros podem fazer upload de banners"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'banners' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Barbeiros podem atualizar seus banners"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'banners' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Barbeiros podem deletar seus banners"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'banners' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS policies for service-images bucket
CREATE POLICY "Imagens de serviços são públicas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'service-images');

CREATE POLICY "Barbeiros podem fazer upload de imagens de serviços"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'service-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Barbeiros podem atualizar imagens de serviços"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'service-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Barbeiros podem deletar imagens de serviços"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'service-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Add image columns to services table
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add profile columns to user metadata (stored via auth.users metadata)
-- This is managed via Supabase Auth, no migration needed