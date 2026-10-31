-- CreateEnum
CREATE TYPE "CreditStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISPUTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CREDIT_ADDED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CREDIT_RESPONSE';

-- CreateTable
CREATE TABLE "ReleaseCredit" (
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" "CreditStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseCredit_pkey" PRIMARY KEY ("postId","userId")
);

-- CreateIndex
CREATE INDEX "ReleaseCredit_userId_status_idx" ON "ReleaseCredit"("userId", "status");

-- AddForeignKey
ALTER TABLE "ReleaseCredit" ADD CONSTRAINT "ReleaseCredit_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseCredit" ADD CONSTRAINT "ReleaseCredit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Reachable only through the app's server role, like every other table.
ALTER TABLE "ReleaseCredit" ENABLE ROW LEVEL SECURITY;

-- Existing releases: their credits become rows. The author's own credit stands; anyone else's waits for them to confirm,
-- and only confirmed musicians stay listed on profiles.
INSERT INTO "ReleaseCredit" ("postId", "userId", "role", "status", "respondedAt")
SELECT p.id, c->>'userId', c->>'role', CASE WHEN c->>'userId' = p."authorId" THEN 'CONFIRMED'::"CreditStatus" ELSE 'PENDING'::"CreditStatus" END, CASE WHEN c->>'userId' = p."authorId" THEN now() END
FROM "Post" p, jsonb_array_elements(COALESCE(p.release->'credits', '[]'::jsonb)) c
WHERE p.release IS NOT NULL AND c->>'userId' IS NOT NULL AND EXISTS (SELECT 1 FROM "User" u WHERE u.id = c->>'userId')
ON CONFLICT DO NOTHING;
UPDATE "Post" p SET "creditUserIds" = ARRAY(SELECT rc."userId" FROM "ReleaseCredit" rc WHERE rc."postId" = p.id AND rc.status = 'CONFIRMED') WHERE p.release IS NOT NULL;
