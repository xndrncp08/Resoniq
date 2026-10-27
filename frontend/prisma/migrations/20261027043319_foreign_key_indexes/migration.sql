-- Covering indexes for foreign keys the database advisor flagged. Additive only:
-- deletes that cascade or set null (accounts, posts, tones) no longer scan these tables.
-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Appeal_decidedById_idx" ON "Appeal"("decidedById");

-- CreateIndex
CREATE INDEX "Bookmark_postId_idx" ON "Bookmark"("postId");

-- CreateIndex
CREATE INDEX "GearItem_createdById_idx" ON "GearItem"("createdById");

-- CreateIndex
CREATE INDEX "Notification_actorId_idx" ON "Notification"("actorId");

-- CreateIndex
CREATE INDEX "Report_resolvedById_idx" ON "Report"("resolvedById");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "ToneSave_toneId_idx" ON "ToneSave"("toneId");

-- CreateIndex
CREATE INDEX "User_pinnedPostId_idx" ON "User"("pinnedPostId");

-- CreateIndex
CREATE INDEX "User_signatureToneId_idx" ON "User"("signatureToneId");

