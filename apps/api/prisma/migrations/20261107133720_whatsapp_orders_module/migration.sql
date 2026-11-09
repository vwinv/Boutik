-- CreateTable
CREATE TABLE "TenantWhatsAppConfig" (
    "tenantId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "displayPhone" TEXT,
    "accessToken" TEXT NOT NULL,
    "businessAccountId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantWhatsAppConfig_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "WhatsAppChatSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'menu',
    "cartJson" JSONB NOT NULL DEFAULT '[]',
    "draftJson" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantWhatsAppConfig_phoneNumberId_key" ON "TenantWhatsAppConfig"("phoneNumberId");

-- CreateIndex
CREATE INDEX "WhatsAppChatSession_tenantId_updatedAt_idx" ON "WhatsAppChatSession"("tenantId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppChatSession_tenantId_waId_key" ON "WhatsAppChatSession"("tenantId", "waId");

-- AddForeignKey
ALTER TABLE "TenantWhatsAppConfig" ADD CONSTRAINT "TenantWhatsAppConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppChatSession" ADD CONSTRAINT "WhatsAppChatSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
