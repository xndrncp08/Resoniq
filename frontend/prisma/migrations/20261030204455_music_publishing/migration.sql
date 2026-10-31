-- AlterEnum
ALTER TYPE "PostCategory" ADD VALUE 'ORIGINAL';

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "creditUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "release" JSONB,
ADD COLUMN     "releaseProjectId" TEXT,
ADD COLUMN     "releaseTakeId" TEXT;

-- CreateIndex
CREATE INDEX "Post_releaseTakeId_idx" ON "Post"("releaseTakeId");

-- CreateIndex
CREATE INDEX "Post_releaseProjectId_idx" ON "Post"("releaseProjectId");

-- CreateIndex
CREATE INDEX "Post_creditUserIds_idx" ON "Post" USING GIN ("creditUserIds");
