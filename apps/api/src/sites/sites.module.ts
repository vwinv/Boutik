import { Module } from "@nestjs/common";
import { ProfessionalsModule } from "../professionals/professionals.module";
import { SitesController } from "./sites.controller";
import { SitesService } from "./sites.service";
import { StorefrontSiteController } from "./storefront-site.controller";
import { WorkspaceSitesController } from "./workspace-sites.controller";

@Module({
  imports: [ProfessionalsModule],
  controllers: [SitesController, StorefrontSiteController, WorkspaceSitesController],
  providers: [SitesService],
  exports: [SitesService],
})
export class SitesModule {}
