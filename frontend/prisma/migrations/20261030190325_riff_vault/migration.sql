-- CreateEnum
CREATE TYPE "RiffStage" AS ENUM ('IDEA', 'DEVELOPING', 'READY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RiffTakeStatus" AS ENUM ('UPLOADING', 'READY');

-- CreateTable
CREATE TABLE "Riff" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "key" TEXT,
    "bpm" INTEGER,
    "stage" "RiffStage" NOT NULL DEFAULT 'IDEA',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "toneId" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Riff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiffTake" (
    "id" TEXT NOT NULL,
    "riffId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "label" TEXT,
    "storageKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationSec" DOUBLE PRECISION,
    "peaks" JSONB,
    "status" "RiffTakeStatus" NOT NULL DEFAULT 'UPLOADING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiffTake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Riff_ownerId_pinned_updatedAt_idx" ON "Riff"("ownerId", "pinned", "updatedAt");

-- CreateIndex
CREATE INDEX "Riff_projectId_idx" ON "Riff"("projectId");

-- CreateIndex
CREATE INDEX "Riff_toneId_idx" ON "Riff"("toneId");

-- CreateIndex
CREATE INDEX "RiffTake_riffId_createdAt_idx" ON "RiffTake"("riffId", "createdAt");

-- CreateIndex
CREATE INDEX "RiffTake_ownerId_createdAt_idx" ON "RiffTake"("ownerId", "createdAt");

-- AddForeignKey
ALTER TABLE "Riff" ADD CONSTRAINT "Riff_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Riff" ADD CONSTRAINT "Riff_toneId_fkey" FOREIGN KEY ("toneId") REFERENCES "Tone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Riff" ADD CONSTRAINT "Riff_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiffTake" ADD CONSTRAINT "RiffTake_riffId_fkey" FOREIGN KEY ("riffId") REFERENCES "Riff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reachable only through the app's server role, like every other table.
ALTER TABLE "Riff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RiffTake" ENABLE ROW LEVEL SECURITY;
