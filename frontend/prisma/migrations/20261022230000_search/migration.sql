-- Full-text search (lib/search.ts). Expression indexes keep the schema free of
-- generated columns; queries must use the exact same expressions to hit them.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Post_search_idx" ON "Post" USING GIN (to_tsvector('english', coalesce("title", '') || ' ' || "body"));
CREATE INDEX "Tone_search_idx" ON "Tone" USING GIN (to_tsvector('english', "name" || ' ' || coalesce("description", '')));
CREATE INDEX "Community_search_idx" ON "Community" USING GIN (to_tsvector('english', "name" || ' ' || "description"));

-- Fuzzy matching for names people half-remember.
CREATE INDEX "User_handle_trgm_idx" ON "User" USING GIN ((lower("handle")) gin_trgm_ops);
CREATE INDEX "User_name_trgm_idx" ON "User" USING GIN ((lower(coalesce("name", ''))) gin_trgm_ops);
CREATE INDEX "GearItem_name_trgm_idx" ON "GearItem" USING GIN ((lower("brand" || ' ' || "model")) gin_trgm_ops);
