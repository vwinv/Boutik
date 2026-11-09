import { Controller, Get, Query } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { CatalogService } from "./catalog.service";
import { CatalogQueryDto } from "./dto/catalog-query.dto";

@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get("categories")
  categories() {
    return this.catalog.listCategories(true);
  }

  @Public()
  @Get("plans")
  plans(@Query() query: CatalogQueryDto) {
    return this.catalog.listPlans(query.category, true);
  }

  @Public()
  @Get("templates")
  templates(@Query() query: CatalogQueryDto) {
    return this.catalog.listTemplates(query.category, true);
  }
}
