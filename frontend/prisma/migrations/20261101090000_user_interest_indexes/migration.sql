-- Musician suggestions find people who share a genre or instrument (array overlap, `&&`).
CREATE INDEX IF NOT EXISTS "User_genres_idx" ON "User" USING GIN ("genres");
CREATE INDEX IF NOT EXISTS "User_instruments_idx" ON "User" USING GIN ("instruments");
