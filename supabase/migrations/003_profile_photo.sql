-- ============================================================
-- 003 — Profile Photos
-- Adds photo_url to users table and creates avatar storage bucket
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url text;

-- Storage bucket for avatars (run via Supabase dashboard or CLI)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
-- ON CONFLICT (id) DO NOTHING;

-- RLS: users can read/write their own avatar folder (path: <user_id>/avatar.jpg)
-- CREATE POLICY "avatars_own_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
-- CREATE POLICY "avatars_own_write" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
-- CREATE POLICY "avatars_own_update" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
-- CREATE POLICY "avatars_own_delete" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
