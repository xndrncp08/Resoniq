-- CreateTable
CREATE TABLE "ListeningRoom" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "takeId" TEXT,
    "playing" BOOLEAN NOT NULL DEFAULT false,
    "positionSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stateAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anyoneControls" BOOLEAN NOT NULL DEFAULT true,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListeningRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomParticipant" (
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomParticipant_pkey" PRIMARY KEY ("roomId","userId")
);

-- CreateTable
CREATE TABLE "RoomComment" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "takeId" TEXT,
    "atSec" DOUBLE PRECISION NOT NULL,
    "body" TEXT,
    "emoji" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListeningRoom_projectId_endedAt_idx" ON "ListeningRoom"("projectId", "endedAt");

-- CreateIndex
CREATE INDEX "RoomComment_roomId_createdAt_idx" ON "RoomComment"("roomId", "createdAt");

-- AddForeignKey
ALTER TABLE "ListeningRoom" ADD CONSTRAINT "ListeningRoom_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomParticipant" ADD CONSTRAINT "RoomParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ListeningRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomComment" ADD CONSTRAINT "RoomComment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ListeningRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reachable only through the app's server role, like every other table.
ALTER TABLE "ListeningRoom" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RoomParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RoomComment" ENABLE ROW LEVEL SECURITY;
