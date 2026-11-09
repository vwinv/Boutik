import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import { IsString, MinLength } from "class-validator";
import type { Response } from "express";
import { Public } from "../auth/decorators/public.decorator";
import { ResolveSiteQueryDto } from "./dto/site-params.dto";
import { SitesService } from "./sites.service";

class SiteAssetIdDto {
  @IsString()
  @MinLength(1)
  assetId: string;
}

@Controller("storefront")
export class StorefrontSiteController {
  constructor(private readonly sites: SitesService) {}

  @Public()
  @Get("site-assets/:assetId")
  async file(
    @Query() query: ResolveSiteQueryDto,
    @Param() params: SiteAssetIdDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.sites.downloadPublicAsset(query, params.assetId);
    if (result.kind === "redirect") {
      res.redirect(result.url);
      return;
    }
    return result.file;
  }
}
