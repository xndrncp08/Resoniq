-- CreateEnum
CREATE TYPE "ToneVisibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "GearKind" AS ENUM ('GUITAR', 'BASS', 'PICKUP', 'AMP', 'CAB', 'PEDAL', 'MULTIFX', 'MODELER', 'PLUGIN');

-- CreateEnum
CREATE TYPE "GearStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');

-- AlterTable
ALTER TABLE "Tone" ADD COLUMN     "description" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "recipeEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "remixCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "remixOfId" TEXT,
ADD COLUMN     "rig" JSONB,
ADD COLUMN     "saveCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "visibility" "ToneVisibility" NOT NULL DEFAULT 'UNLISTED',
ALTER COLUMN "data" DROP NOT NULL;

-- CreateTable
CREATE TABLE "GearItem" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "GearKind" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "description" TEXT,
    "controls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "GearStatus" NOT NULL DEFAULT 'APPROVED',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GearItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToneGear" (
    "toneId" TEXT NOT NULL,
    "gearItemId" TEXT NOT NULL,

    CONSTRAINT "ToneGear_pkey" PRIMARY KEY ("toneId","gearItemId")
);

-- CreateTable
CREATE TABLE "ToneSave" (
    "userId" TEXT NOT NULL,
    "toneId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToneSave_pkey" PRIMARY KEY ("userId","toneId")
);

-- CreateIndex
CREATE UNIQUE INDEX "GearItem_slug_key" ON "GearItem"("slug");

-- CreateIndex
CREATE INDEX "GearItem_kind_status_idx" ON "GearItem"("kind", "status");

-- CreateIndex
CREATE INDEX "GearItem_status_createdAt_idx" ON "GearItem"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ToneGear_gearItemId_idx" ON "ToneGear"("gearItemId");

-- CreateIndex
CREATE INDEX "ToneSave_userId_createdAt_idx" ON "ToneSave"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Tone_visibility_publishedAt_idx" ON "Tone"("visibility", "publishedAt");

-- CreateIndex
CREATE INDEX "Tone_visibility_saveCount_idx" ON "Tone"("visibility", "saveCount");

-- CreateIndex
CREATE INDEX "Tone_remixOfId_idx" ON "Tone"("remixOfId");

-- AddForeignKey
ALTER TABLE "Tone" ADD CONSTRAINT "Tone_remixOfId_fkey" FOREIGN KEY ("remixOfId") REFERENCES "Tone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GearItem" ADD CONSTRAINT "GearItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToneGear" ADD CONSTRAINT "ToneGear_toneId_fkey" FOREIGN KEY ("toneId") REFERENCES "Tone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToneGear" ADD CONSTRAINT "ToneGear_gearItemId_fkey" FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToneSave" ADD CONSTRAINT "ToneSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToneSave" ADD CONSTRAINT "ToneSave_toneId_fkey" FOREIGN KEY ("toneId") REFERENCES "Tone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

