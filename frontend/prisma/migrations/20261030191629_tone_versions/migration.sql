-- CreateEnum
CREATE TYPE "ToneVersionKind" AS ENUM ('BASELINE', 'CREATED', 'SAVED', 'RESTORED');

-- CreateTable
CREATE TABLE "ToneVersion" (
    "id" TEXT NOT NULL,
    "toneId" TEXT NOT NULL,
    "kind" "ToneVersionKind" NOT NULL DEFAULT 'SAVED',
    "name" TEXT NOT NULL,
    "data" JSONB,
    "rig" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToneVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToneVersion_toneId_createdAt_idx" ON "ToneVersion"("toneId", "createdAt");

-- AddForeignKey
ALTER TABLE "ToneVersion" ADD CONSTRAINT "ToneVersion_toneId_fkey" FOREIGN KEY ("toneId") REFERENCES "Tone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reachable only through the app's server role, like every other table.
ALTER TABLE "ToneVersion" ENABLE ROW LEVEL SECURITY;
