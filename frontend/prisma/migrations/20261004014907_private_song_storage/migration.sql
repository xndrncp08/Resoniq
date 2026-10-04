-- AlterTable
ALTER TABLE "Song" ADD COLUMN     "storageKey" TEXT,
ALTER COLUMN "fileUrl" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Song_userId_idx" ON "Song"("userId");

-- CreateIndex
CREATE INDEX "Tone_userId_favorite_createdAt_idx" ON "Tone"("userId", "favorite", "createdAt");
