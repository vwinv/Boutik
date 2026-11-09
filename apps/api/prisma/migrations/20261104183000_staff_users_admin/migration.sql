-- AlterEnum
ALTER TYPE "StaffRole" ADD VALUE 'FINANCE';
ALTER TYPE "StaffRole" ADD VALUE 'MODERATION';

-- CreateEnum
CREATE TYPE "StaffAccountStatus" AS ENUM ('ACTIVE', 'DISABLED', 'INVITED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "staffStatus" "StaffAccountStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN "staffTwoFaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "staffInvitedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_staffRole_staffStatus_idx" ON "User"("staffRole", "staffStatus");
