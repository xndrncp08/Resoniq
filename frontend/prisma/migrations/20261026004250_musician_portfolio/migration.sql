-- Musician portfolios. Additive: new nullable or empty-default columns and a new
-- table, so existing profiles are unchanged.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "influences" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "location" TEXT,
ADD COLUMN     "openTo" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "pinnedPostId" TEXT,
ADD COLUMN     "signatureToneId" TEXT;

-- CreateTable
CREATE TABLE "UserGear" (
    "userId" TEXT NOT NULL,
    "gearItemId" TEXT NOT NULL,
    "note" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserGear_pkey" PRIMARY KEY ("userId","gearItemId")
);

-- CreateIndex
CREATE INDEX "UserGear_gearItemId_idx" ON "UserGear"("gearItemId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_pinnedPostId_fkey" FOREIGN KEY ("pinnedPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_signatureToneId_fkey" FOREIGN KEY ("signatureToneId") REFERENCES "Tone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGear" ADD CONSTRAINT "UserGear_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGear" ADD CONSTRAINT "UserGear_gearItemId_fkey" FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Like every table, reachable only through the app's server role.
ALTER TABLE "UserGear" ENABLE ROW LEVEL SECURITY;
