-- Followers hear about new releases from people they follow.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_RELEASE';
