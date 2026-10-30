-- CreateTable
CREATE TABLE "Setlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "venue" TEXT,
    "date" TIMESTAMP(3),
    "notes" TEXT,
    "items" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Setlist_userId_updatedAt_idx" ON "Setlist"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "Setlist" ADD CONSTRAINT "Setlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reachable only through the app's server role, like every other table.
ALTER TABLE "Setlist" ENABLE ROW LEVEL SECURITY;
