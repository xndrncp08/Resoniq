BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- AlterTable
-- Retain legacy anonymous content; new generated tones carry managed attribution.
ALTER TABLE "Tone" DROP CONSTRAINT "Tone_generated_is_anonymous";

ALTER TABLE "ToneDraft" ADD COLUMN     "communityId" TEXT,
ADD COLUMN     "creatorId" TEXT,
ADD COLUMN     "postId" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ManagedCreator" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "owner" TEXT NOT NULL DEFAULT 'Resoniq',
    "specialization" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagedCreator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TonePublishingControl" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "paused" BOOLEAN NOT NULL DEFAULT true,
    "initialImportAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TonePublishingControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TonePublishingEvent" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "toneId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TonePublishingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagedCreator_userId_key" ON "ManagedCreator"("userId");

-- CreateIndex
CREATE INDEX "TonePublishingEvent_source_action_createdAt_idx" ON "TonePublishingEvent"("source", "action", "createdAt");

-- CreateIndex
CREATE INDEX "TonePublishingEvent_draftId_createdAt_idx" ON "TonePublishingEvent"("draftId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ToneDraft_postId_key" ON "ToneDraft"("postId");
CREATE INDEX "ToneDraft_creatorId_idx" ON "ToneDraft"("creatorId");
CREATE INDEX "ToneDraft_communityId_idx" ON "ToneDraft"("communityId");
CREATE INDEX "ToneDraft_reviewedById_idx" ON "ToneDraft"("reviewedById");

-- AddForeignKey
ALTER TABLE "ToneDraft" ADD CONSTRAINT "ToneDraft_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "ManagedCreator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToneDraft" ADD CONSTRAINT "ToneDraft_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToneDraft" ADD CONSTRAINT "ToneDraft_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedCreator" ADD CONSTRAINT "ManagedCreator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TonePublishingEvent" ADD CONSTRAINT "TonePublishingEvent_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ToneDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ManagedCreator" ADD CONSTRAINT "ManagedCreator_owner" CHECK ("owner" = 'Resoniq');
ALTER TABLE "TonePublishingControl" ADD CONSTRAINT "TonePublishingControl_singleton" CHECK ("id" = 'default');

-- No OAuth link or database session may ever turn a publishing identity into a login.
CREATE FUNCTION public.resoniq_system_login_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."User" WHERE id = NEW."userId" AND kind = 'SYSTEM') THEN
    RAISE EXCEPTION 'System publishing identities cannot sign in';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.resoniq_system_login_guard() FROM PUBLIC;
CREATE TRIGGER "Account_system_login_guard" BEFORE INSERT OR UPDATE ON "Account"
FOR EACH ROW EXECUTE FUNCTION public.resoniq_system_login_guard();
CREATE TRIGGER "Session_system_login_guard" BEFORE INSERT OR UPDATE ON "Session"
FOR EACH ROW EXECUTE FUNCTION public.resoniq_system_login_guard();

CREATE FUNCTION public.resoniq_managed_creator_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."User" WHERE id = NEW."userId" AND kind = 'SYSTEM') THEN
    RAISE EXCEPTION 'Managed creators must be non-login system identities';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.resoniq_managed_creator_guard() FROM PUBLIC;
CREATE TRIGGER "ManagedCreator_system_guard" BEFORE INSERT OR UPDATE ON "ManagedCreator"
FOR EACH ROW EXECUTE FUNCTION public.resoniq_managed_creator_guard();

CREATE FUNCTION public.resoniq_identity_kind_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.kind <> OLD.kind THEN
    IF OLD.kind = 'SYSTEM' OR EXISTS (SELECT 1 FROM public."Account" WHERE "userId" = NEW.id)
      OR EXISTS (SELECT 1 FROM public."Session" WHERE "userId" = NEW.id) THEN
      RAISE EXCEPTION 'Publishing identities cannot be converted to or from login accounts';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.resoniq_identity_kind_guard() FROM PUBLIC;
CREATE TRIGGER "User_identity_kind_guard" BEFORE UPDATE OF kind ON "User"
FOR EACH ROW EXECUTE FUNCTION public.resoniq_identity_kind_guard();

-- Auth.js/Prisma uses the server database role; these are never Data API tables.
ALTER TABLE "ToneDraft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ManagedCreator" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TonePublishingControl" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TonePublishingEvent" ENABLE ROW LEVEL SECURITY;

COMMIT;
