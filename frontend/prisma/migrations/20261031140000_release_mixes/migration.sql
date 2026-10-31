-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "releaseTakeIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ReleaseRevision" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "release" JSONB NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReleaseRevision_postId_createdAt_idx" ON "ReleaseRevision"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_releaseTakeIds_idx" ON "Post" USING GIN ("releaseTakeIds");

-- AddForeignKey
ALTER TABLE "ReleaseRevision" ADD CONSTRAINT "ReleaseRevision_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Reachable only through the app's server role, like every other table.
ALTER TABLE "ReleaseRevision" ENABLE ROW LEVEL SECURITY;

-- Existing releases: their one take becomes the list's main mix.
UPDATE "Post" SET "releaseTakeIds" = ARRAY["releaseTakeId"] WHERE "releaseTakeId" IS NOT NULL;
