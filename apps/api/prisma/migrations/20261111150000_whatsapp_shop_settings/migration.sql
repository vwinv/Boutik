-- AlterTable
ALTER TABLE "TenantWhatsAppConfig" ADD COLUMN "shopOpen" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TenantWhatsAppConfig" ADD COLUMN "allowPickup" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TenantWhatsAppConfig" ADD COLUMN "allowDelivery" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TenantWhatsAppConfig" ADD COLUMN "welcomeMessage" TEXT;
ALTER TABLE "TenantWhatsAppConfig" ADD COLUMN "closedMessage" TEXT;
ALTER TABLE "TenantWhatsAppConfig" ADD COLUMN "openTime" TEXT;
ALTER TABLE "TenantWhatsAppConfig" ADD COLUMN "closeTime" TEXT;
ALTER TABLE "TenantWhatsAppConfig" ADD COLUMN "lastInboundAt" TIMESTAMP(3);
