import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { StaffRoles } from "../auth/decorators/staff-roles.decorator";
import { IdParamDto } from "../professionals/dto/id.param";
import { AdminCatalogService } from "./admin-catalog.service";
import { CatalogQueryDto } from "./dto/catalog-query.dto";
import {
  CategoryCodeParamDto,
  CreatePlanDto,
  CreatePlanOptionDto,
  CreateSubcategoryDto,
  CreateTemplateDto,
  ReplacePricesDto,
  UpdatePlanDto,
  UpdatePlanOptionDto,
  UpdateSiteCategoryDto,
  UpdateSubcategoryDto,
  UpdateTemplateDto,
} from "./dto/admin-catalog.dto";

@Controller("admin/catalog")
@RequireAudience("staff")
@StaffRoles("SUPPORT")
export class AdminCatalogController {
  constructor(private readonly catalog: AdminCatalogService) {}

  @Get("categories")
  categories() {
    return this.catalog.listCategories();
  }

  @Patch("categories/:code")
  @StaffRoles("ADMIN")
  updateCategory(@Param() params: CategoryCodeParamDto, @Body() body: UpdateSiteCategoryDto) {
    return this.catalog.updateCategory(params.code, body);
  }

  @Post("subcategories")
  @StaffRoles("ADMIN")
  createSubcategory(@Body() body: CreateSubcategoryDto) {
    return this.catalog.createSubcategory(body);
  }

  @Patch("subcategories/:id")
  @StaffRoles("ADMIN")
  updateSubcategory(@Param() params: IdParamDto, @Body() body: UpdateSubcategoryDto) {
    return this.catalog.updateSubcategory(params.id, body);
  }

  @Delete("subcategories/:id")
  @StaffRoles("ADMIN")
  deleteSubcategory(@Param() params: IdParamDto) {
    return this.catalog.deleteSubcategory(params.id);
  }

  @Get("offers")
  offers(@Query() query: CatalogQueryDto) {
    return this.catalog.listOffersOverview(query.category);
  }

  @Get("plans")
  plans() {
    return this.catalog.listPlans();
  }

  @Post("plans")
  @StaffRoles("ADMIN")
  createPlan(@Body() body: CreatePlanDto) {
    return this.catalog.createPlan(body);
  }

  @Patch("plans/:id")
  @StaffRoles("ADMIN")
  updatePlan(@Param() params: IdParamDto, @Body() body: UpdatePlanDto) {
    return this.catalog.updatePlan(params.id, body);
  }

  @Delete("plans/:id")
  @StaffRoles("ADMIN")
  deletePlan(@Param() params: IdParamDto) {
    return this.catalog.deletePlan(params.id);
  }

  @Put("plans/:id/prices")
  @StaffRoles("ADMIN")
  replacePrices(@Param() params: IdParamDto, @Body() body: ReplacePricesDto) {
    return this.catalog.replacePrices(params.id, body.prices);
  }

  @Post("plans/:id/options")
  @StaffRoles("ADMIN")
  createOption(@Param() params: IdParamDto, @Body() body: CreatePlanOptionDto) {
    return this.catalog.createOption(params.id, body);
  }

  @Patch("plans/:id/options/:optionId")
  @StaffRoles("ADMIN")
  updateOption(
    @Param("id") planId: string,
    @Param("optionId") optionId: string,
    @Body() body: UpdatePlanOptionDto,
  ) {
    return this.catalog.updateOption(planId, optionId, body);
  }

  @Delete("plans/:id/options/:optionId")
  @StaffRoles("ADMIN")
  deleteOption(@Param("id") planId: string, @Param("optionId") optionId: string) {
    return this.catalog.deleteOption(planId, optionId);
  }

  @Get("templates")
  templates() {
    return this.catalog.listTemplates();
  }

  @Post("templates")
  @StaffRoles("ADMIN")
  createTemplate(@Body() body: CreateTemplateDto) {
    return this.catalog.createTemplate(body);
  }

  @Patch("templates/:id")
  @StaffRoles("ADMIN")
  updateTemplate(@Param() params: IdParamDto, @Body() body: UpdateTemplateDto) {
    return this.catalog.updateTemplate(params.id, body);
  }

  @Delete("templates/:id")
  @StaffRoles("ADMIN")
  deleteTemplate(@Param() params: IdParamDto) {
    return this.catalog.deleteTemplate(params.id);
  }
}
