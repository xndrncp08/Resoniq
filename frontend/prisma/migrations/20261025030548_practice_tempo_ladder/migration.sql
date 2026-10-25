-- Tempo ladder (practice room). Additive only: two new tables, nothing existing changes.
-- CreateTable
CREATE TABLE "PracticePassage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetBpm" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticePassage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeTake" (
    "id" TEXT NOT NULL,
    "passageId" TEXT NOT NULL,
    "bpm" INTEGER NOT NULL,
    "clean" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeTake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PracticePassage_userId_updatedAt_idx" ON "PracticePassage"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "PracticeTake_passageId_createdAt_idx" ON "PracticeTake"("passageId", "createdAt");

-- AddForeignKey
ALTER TABLE "PracticePassage" ADD CONSTRAINT "PracticePassage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeTake" ADD CONSTRAINT "PracticeTake_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "PracticePassage"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The API validates these too; the database is the last line.
ALTER TABLE "PracticePassage" ADD CONSTRAINT "PracticePassage_targetBpm_range" CHECK ("targetBpm" BETWEEN 30 AND 240);
ALTER TABLE "PracticePassage" ADD CONSTRAINT "PracticePassage_title_length" CHECK (char_length("title") BETWEEN 1 AND 120);
ALTER TABLE "PracticeTake" ADD CONSTRAINT "PracticeTake_bpm_range" CHECK ("bpm" BETWEEN 30 AND 240);

-- Prisma uses the server database role; these are never Data API tables.
ALTER TABLE "PracticePassage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PracticeTake" ENABLE ROW LEVEL SECURITY;
