-- Profile avatar sources. Additive: two nullable columns, then a backfill that
-- only copies values already in "image", so nobody's current avatar changes.
ALTER TABLE "User" ADD COLUMN "providerImage" TEXT,
ADD COLUMN "uploadedImage" TEXT;

-- Remember each member's current Google photo and current upload so the
-- avatar picker can offer them again after a default avatar is chosen.
UPDATE "User" SET "providerImage" = "image" WHERE "image" LIKE 'https://lh3.googleusercontent.com/%';
UPDATE "User" SET "uploadedImage" = "image" WHERE "image" LIKE '/api/media/%';
