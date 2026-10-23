-- Ordered indexes for the public listings, measured on 20k tones / 30k posts:
-- /tones newest 35 ms -> 0.15 ms, most saved -> 0.17 ms, home feed by hot rank 24 ms -> 0.13 ms.
-- The feed filters status with an OR (own held posts), so its index can't lead with status.
-- Additive only; on the current production tables these build instantly.
CREATE INDEX IF NOT EXISTS "Tone_visibility_createdAt_id_idx" ON "Tone"("visibility", "createdAt" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "Tone_visibility_saveCount_id_idx" ON "Tone"("visibility", "saveCount" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "Post_hotRank_id_idx" ON "Post"("hotRank" DESC, "id" DESC);
