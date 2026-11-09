import { Module } from "@nestjs/common";
import { ProfessionalsModule } from "../professionals/professionals.module";
import { ProductsService } from "./products.service";
import { StorefrontCatalogController } from "./storefront-catalog.controller";
import { WorkspaceProductsController } from "./workspace-products.controller";

@Module({
  imports: [ProfessionalsModule],
  controllers: [StorefrontCatalogController, WorkspaceProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
