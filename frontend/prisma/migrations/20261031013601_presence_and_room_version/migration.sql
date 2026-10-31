-- AlterTable
ALTER TABLE "ListeningRoom" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Presence" (
    "scope" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "detail" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Presence_pkey" PRIMARY KEY ("scope","userId")
);

-- CreateIndex
CREATE INDEX "Presence_scope_lastSeenAt_idx" ON "Presence"("scope", "lastSeenAt");

-- Reachable only through the app's server role, like every other table.
ALTER TABLE "Presence" ENABLE ROW LEVEL SECURITY;
