-- CreateEnum
CREATE TYPE "UserKind" AS ENUM ('PERSON', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ToneOrigin" AS ENUM ('MEMBER', 'GENERATED');

-- CreateEnum
CREATE TYPE "ToneDraftStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'UNPUBLISHED');

-- AlterTable
ALTER TABLE "Tone" ADD COLUMN     "anonymous" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "origin" "ToneOrigin" NOT NULL DEFAULT 'MEMBER';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "kind" "UserKind" NOT NULL DEFAULT 'PERSON';

-- CreateTable
CREATE TABLE "ToneDraft" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" "ToneDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rig" JSONB NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "toneId" TEXT,
    "error" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToneDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ToneDraft_key_key" ON "ToneDraft"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ToneDraft_fingerprint_key" ON "ToneDraft"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "ToneDraft_toneId_key" ON "ToneDraft"("toneId");

-- CreateIndex
CREATE INDEX "ToneDraft_status_scheduledFor_idx" ON "ToneDraft"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "Tone_origin_visibility_createdAt_idx" ON "Tone"("origin", "visibility", "createdAt");

-- AddForeignKey
ALTER TABLE "ToneDraft" ADD CONSTRAINT "ToneDraft_toneId_fkey" FOREIGN KEY ("toneId") REFERENCES "Tone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToneDraft" ADD CONSTRAINT "ToneDraft_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Integrity rules Prisma can't express (lib/system-identity.ts, lib/tone-drafts.ts).
-- Generated tones never show an owner.
ALTER TABLE "Tone" ADD CONSTRAINT "Tone_generated_is_anonymous" CHECK ("origin" <> 'GENERATED' OR "anonymous");
-- A system identity is never staff and has nothing to sign in with.
ALTER TABLE "User" ADD CONSTRAINT "User_system_not_staff" CHECK ("kind" <> 'SYSTEM' OR "role" = 'USER');
ALTER TABLE "User" ADD CONSTRAINT "User_system_no_credentials" CHECK ("kind" <> 'SYSTEM' OR ("email" IS NULL AND "passwordHash" IS NULL));
