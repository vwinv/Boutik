-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "SupportTicket" ADD COLUMN "assignedToUserId" TEXT;

-- CreateIndex
CREATE INDEX "SupportTicket_assignedToUserId_idx" ON "SupportTicket"("assignedToUserId");

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
