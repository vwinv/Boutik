-- AlterTable
ALTER TABLE "Product" ADD COLUMN "stockQty" INTEGER,
ADD COLUMN "lowStockThreshold" INTEGER,
ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Product_tenantId_isFeatured_idx" ON "Product"("tenantId", "isFeatured");
