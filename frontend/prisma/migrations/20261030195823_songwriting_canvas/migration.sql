-- CreateTable
CREATE TABLE "SongCanvas" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "key" TEXT,
    "bpm" INTEGER,
    "sections" JSONB NOT NULL DEFAULT '[]',
    "arrangement" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongCanvas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongCanvasRevision" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "authorId" TEXT,
    "title" TEXT NOT NULL,
    "key" TEXT,
    "bpm" INTEGER,
    "sections" JSONB NOT NULL,
    "arrangement" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongCanvasRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SongCanvas_ownerId_updatedAt_idx" ON "SongCanvas"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "SongCanvas_projectId_idx" ON "SongCanvas"("projectId");

-- CreateIndex
CREATE INDEX "SongCanvasRevision_canvasId_createdAt_idx" ON "SongCanvasRevision"("canvasId", "createdAt");

-- AddForeignKey
ALTER TABLE "SongCanvas" ADD CONSTRAINT "SongCanvas_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongCanvas" ADD CONSTRAINT "SongCanvas_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongCanvasRevision" ADD CONSTRAINT "SongCanvasRevision_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "SongCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reachable only through the app's server role, like every other table.
ALTER TABLE "SongCanvas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SongCanvasRevision" ENABLE ROW LEVEL SECURITY;
