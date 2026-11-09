import { Controller, Get, Query } from "@nestjs/common";
import { API_ERROR_CODES } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { Public } from "../auth/decorators/public.decorator";
import { ResolveSiteQueryDto, SiteSlugQueryDto } from "./dto/site-params.dto";
import { SitesService } from "./sites.service";

@Controller("sites")
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  @Public()
  @Get("slug")
  slug(@Query() query: SiteSlugQueryDto) {
    if (!query.name && !query.slug) {
      throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "Indiquez un nom ou un slug");
    }
    return this.sites.suggestSlug(query);
  }

  @Public()
  @Get("resolve")
  resolve(@Query() query: ResolveSiteQueryDto) {
    return this.sites.resolve(query);
  }
}
