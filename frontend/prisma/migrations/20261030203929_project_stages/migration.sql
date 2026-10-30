-- CreateEnum
CREATE TYPE "ProjectStage" AS ENUM ('IDEA', 'WRITING', 'RECORDING', 'REVIEWING', 'RELEASED');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "stage" "ProjectStage";
