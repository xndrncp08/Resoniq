-- AlterTable
ALTER TABLE "Tone" ADD COLUMN     "dnaBright" DOUBLE PRECISION,
ADD COLUMN     "dnaDrive" DOUBLE PRECISION,
ADD COLUMN     "dnaLow" DOUBLE PRECISION,
ADD COLUMN     "dnaMid" DOUBLE PRECISION,
ADD COLUMN     "dnaMotion" DOUBLE PRECISION,
ADD COLUMN     "dnaSpace" DOUBLE PRECISION,
ADD COLUMN     "dnaSqueeze" DOUBLE PRECISION,
ADD COLUMN     "dnaVersion" INTEGER;

-- CreateIndex
CREATE INDEX "Tone_visibility_dnaDrive_idx" ON "Tone"("visibility", "dnaDrive");
