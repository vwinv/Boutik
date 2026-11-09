import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { memoryStorage } from "multer";
import { API_ERROR_CODES } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import {
  ReorderIdsDto,
  SiteAssetParamDto,
  SitePageParamDto,
  SiteSectionParamDto,
  WorkspaceIdParamDto,
} from "./dto/site-params.dto";
import {
  CreatePageDto,
  CreateSectionDto,
  CreateSiteDto,
  SuspendSiteDto,
  UpdateSiteContactDto,
  UpdateSiteDraftDto,
  UpdateSiteGeneralDto,
  UpdateSiteHoursDto,
  UpdateSiteSeoDto,
  UpdateSiteSocialDto,
  UpdateSiteThemeDto,
  UploadSiteVisualDto,
  UpsertPageDto,
  UpsertSectionDto,
} from "./dto/update-site.dto";
import { SitesService } from "./sites.service";

@Controller("workspaces")
@RequireAudience("pro")
export class WorkspaceSitesController {
  constructor(private readonly sites: SitesService) {}

  @Post(":id/site")
  create(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Body() body: CreateSiteDto) {
    return this.sites.create(user.id, params.id, body);
  }

  @Get(":id/site")
  get(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto) {
    return this.sites.getMine(user.id, params.id);
  }

  @Get(":id/site/preview")
  preview(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto) {
    return this.sites.preview(user.id, params.id);
  }

  @Patch(":id/site")
  updateGeneral(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Body() body: UpdateSiteGeneralDto) {
    return this.sites.updateGeneral(user.id, params.id, body);
  }

  @Patch(":id/site/theme")
  updateTheme(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Body() body: UpdateSiteThemeDto) {
    return this.sites.updateTheme(user.id, params.id, body);
  }

  @Patch(":id/site/contact")
  updateContact(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Body() body: UpdateSiteContactDto) {
    return this.sites.updateContact(user.id, params.id, body);
  }

  @Patch(":id/site/social")
  updateSocial(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Body() body: UpdateSiteSocialDto) {
    return this.sites.updateSocial(user.id, params.id, body);
  }

  @Patch(":id/site/hours")
  updateHours(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Body() body: UpdateSiteHoursDto) {
    return this.sites.updateHours(user.id, params.id, body);
  }

  @Post(":id/site/visuals")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadVisual(
    @CurrentUser() user: RequestUser,
    @Param() params: WorkspaceIdParamDto,
    @Body() body: UploadSiteVisualDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Un visuel est requis");
    }
    return this.sites.uploadVisual(user.id, params.id, body.kind, file, body.alt);
  }

  @Get(":id/site/assets/:assetId/file")
  async downloadAsset(
    @CurrentUser() user: RequestUser,
    @Param() params: SiteAssetParamDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.sites.downloadOwnedAsset(user.id, params.id, params.assetId);
    if (result.kind === "redirect") {
      res.redirect(result.url);
      return;
    }
    return result.file;
  }

  @Patch(":id/site/seo")
  updateSeo(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Body() body: UpdateSiteSeoDto) {
    return this.sites.updateSeo(user.id, params.id, body);
  }

  @Post(":id/site/draft")
  saveDraft(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Body() body: UpdateSiteDraftDto) {
    return this.sites.saveDraft(user.id, params.id, body);
  }

  @Post(":id/site/publish")
  publish(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto) {
    return this.sites.publish(user.id, params.id);
  }

  @Post(":id/site/unpublish")
  unpublish(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto) {
    return this.sites.unpublish(user.id, params.id);
  }

  @Post(":id/site/suspend")
  suspend(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Body() body: SuspendSiteDto) {
    return this.sites.suspend(user.id, params.id, body);
  }

  @Get(":id/site/pages")
  listPages(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto) {
    return this.sites.listPages(user.id, params.id);
  }

  @Patch(":id/site/pages/reorder")
  reorderPages(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Body() body: ReorderIdsDto) {
    return this.sites.reorderPages(user.id, params.id, body);
  }

  @Post(":id/site/pages")
  createPage(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Body() body: CreatePageDto) {
    return this.sites.createPage(user.id, params.id, body);
  }

  @Get(":id/site/pages/:pageId")
  getPage(@CurrentUser() user: RequestUser, @Param() params: SitePageParamDto) {
    return this.sites.getPage(user.id, params.id, params.pageId);
  }

  @Patch(":id/site/pages/:pageId")
  updatePage(@CurrentUser() user: RequestUser, @Param() params: SitePageParamDto, @Body() body: UpsertPageDto) {
    return this.sites.updatePage(user.id, params.id, params.pageId, body);
  }

  @Delete(":id/site/pages/:pageId")
  removePage(@CurrentUser() user: RequestUser, @Param() params: SitePageParamDto) {
    return this.sites.removePage(user.id, params.id, params.pageId);
  }

  @Patch(":id/site/pages/:pageId/sections/reorder")
  reorderSections(@CurrentUser() user: RequestUser, @Param() params: SitePageParamDto, @Body() body: ReorderIdsDto) {
    return this.sites.reorderSections(user.id, params.id, params.pageId, body);
  }

  @Post(":id/site/pages/:pageId/sections")
  createSection(@CurrentUser() user: RequestUser, @Param() params: SitePageParamDto, @Body() body: CreateSectionDto) {
    return this.sites.createSection(user.id, params.id, params.pageId, body);
  }

  @Post(":id/site/pages/:pageId/sections/:sectionId/image")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadSectionImage(
    @CurrentUser() user: RequestUser,
    @Param() params: SiteSectionParamDto,
    @UploadedFile() file?: Express.Multer.File,
    @Body("alt") alt?: string,
  ) {
    if (!file) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Une image est requise");
    }
    return this.sites.uploadSectionImage(user.id, params.id, params.pageId, params.sectionId, file, alt);
  }

  @Patch(":id/site/pages/:pageId/sections/:sectionId")
  updateSection(
    @CurrentUser() user: RequestUser,
    @Param() params: SiteSectionParamDto,
    @Body() body: UpsertSectionDto,
  ) {
    return this.sites.updateSection(user.id, params.id, params.pageId, params.sectionId, body);
  }

  @Delete(":id/site/pages/:pageId/sections/:sectionId")
  removeSection(@CurrentUser() user: RequestUser, @Param() params: SiteSectionParamDto) {
    return this.sites.removeSection(user.id, params.id, params.pageId, params.sectionId);
  }
}
