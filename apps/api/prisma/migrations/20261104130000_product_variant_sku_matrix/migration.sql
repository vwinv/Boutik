-- Shein-lite: options + stock par combinaison (SKU)
ALTER TABLE "ProductVariant" ADD COLUMN "stockQty" INTEGER;
ALTER TABLE "ProductVariant" ADD COLUMN "lowStockThreshold" INTEGER;
ALTER TABLE "ProductVariant" ADD COLUMN "option1Kind" TEXT;
ALTER TABLE "ProductVariant" ADD COLUMN "option1Value" TEXT;
ALTER TABLE "ProductVariant" ADD COLUMN "option2Kind" TEXT;
ALTER TABLE "ProductVariant" ADD COLUMN "option2Value" TEXT;

CREATE INDEX "ProductVariant_productId_option1Kind_option1Value_idx"
  ON "ProductVariant"("productId", "option1Kind", "option1Value");
