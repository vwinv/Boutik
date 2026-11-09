import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { memoryStorage } from "multer";
import { API_ERROR_CODES } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import {
  CreateProductCategoryDto,
  CreateProductDto,
  CreateVariantDto,
  ProductCategoryParamDto,
  ProductParamDto,
  ProductPhotoParamDto,
  ProductVariantParamDto,
  ReorderDto,
  UpdatePhotoDto,
  UpdateProductCategoryDto,
  UpdateProductDto,
  UpdateVariantDto,
  WorkspaceIdParamDto,
} from "./dto/product.dto";
import { ProductsService } from "./products.service";

@Controller("workspaces")
@RequireAudience("pro")
export class WorkspaceProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get(":id/product-categories")
  listCategories(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto) {
    return this.products.listCategories(user.id, params.id);
  }

  @Post(":id/product-categories")
  createCategory(
    @CurrentUser() user: RequestUser,
    @Param() params: WorkspaceIdParamDto,
    @Body() body: CreateProductCategoryDto,
  ) {
    return this.products.createCategory(user.id, params.id, body);
  }

  @Patch(":id/product-categories/reorder")
  reorderCategories(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Body() body: ReorderDto) {
    return this.products.reorderCategories(user.id, params.id, body);
  }

  @Patch(":id/product-categories/:categoryId")
  updateCategory(
    @CurrentUser() user: RequestUser,
    @Param() params: ProductCategoryParamDto,
    @Body() body: UpdateProductCategoryDto,
  ) {
    return this.products.updateCategory(user.id, params.id, params.categoryId, body);
  }

  @Delete(":id/product-categories/:categoryId")
  removeCategory(@CurrentUser() user: RequestUser, @Param() params: ProductCategoryParamDto) {
    return this.products.removeCategory(user.id, params.id, params.categoryId);
  }

  @Get(":id/products")
  listProducts(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto) {
    return this.products.listProducts(user.id, params.id);
  }

  @Post(":id/products")
  createProduct(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Body() body: CreateProductDto) {
    return this.products.createProduct(user.id, params.id, body);
  }

  @Patch(":id/products/reorder")
  reorderProducts(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Body() body: ReorderDto) {
    return this.products.reorderProducts(user.id, params.id, body);
  }

  @Get(":id/products/:productId")
  getProduct(@CurrentUser() user: RequestUser, @Param() params: ProductParamDto) {
    return this.products.getProduct(user.id, params.id, params.productId);
  }

  @Patch(":id/products/:productId")
  updateProduct(@CurrentUser() user: RequestUser, @Param() params: ProductParamDto, @Body() body: UpdateProductDto) {
    return this.products.updateProduct(user.id, params.id, params.productId, body);
  }

  @Post(":id/products/:productId/activate")
  activate(@CurrentUser() user: RequestUser, @Param() params: ProductParamDto) {
    return this.products.setActive(user.id, params.id, params.productId, true);
  }

  @Post(":id/products/:productId/deactivate")
  deactivate(@CurrentUser() user: RequestUser, @Param() params: ProductParamDto) {
    return this.products.setActive(user.id, params.id, params.productId, false);
  }

  @Delete(":id/products/:productId")
  removeProduct(@CurrentUser() user: RequestUser, @Param() params: ProductParamDto) {
    return this.products.removeProduct(user.id, params.id, params.productId);
  }

  @Post(":id/products/:productId/variants")
  createVariant(@CurrentUser() user: RequestUser, @Param() params: ProductParamDto, @Body() body: CreateVariantDto) {
    return this.products.createVariant(user.id, params.id, params.productId, body);
  }

  @Patch(":id/products/:productId/variants/:variantId")
  updateVariant(
    @CurrentUser() user: RequestUser,
    @Param() params: ProductVariantParamDto,
    @Body() body: UpdateVariantDto,
  ) {
    return this.products.updateVariant(user.id, params.id, params.productId, params.variantId, body);
  }

  @Delete(":id/products/:productId/variants/:variantId")
  removeVariant(@CurrentUser() user: RequestUser, @Param() params: ProductVariantParamDto) {
    return this.products.removeVariant(user.id, params.id, params.productId, params.variantId);
  }

  @Post(":id/products/:productId/photos")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  addPhoto(
    @CurrentUser() user: RequestUser,
    @Param() params: ProductParamDto,
    @UploadedFile() file?: Express.Multer.File,
    @Body("alt") alt?: string,
    @Body("optionKind") optionKind?: string,
    @Body("optionValue") optionValue?: string,
  ) {
    if (!file) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Une photo est requise");
    }
    return this.products.addPhoto(user.id, params.id, params.productId, file, alt, {
      kind: optionKind,
      value: optionValue,
    });
  }

  @Patch(":id/products/:productId/photos/reorder")
  reorderPhotos(@CurrentUser() user: RequestUser, @Param() params: ProductParamDto, @Body() body: ReorderDto) {
    return this.products.reorderPhotos(user.id, params.id, params.productId, body);
  }

  @Patch(":id/products/:productId/photos/:photoId")
  updatePhoto(@CurrentUser() user: RequestUser, @Param() params: ProductPhotoParamDto, @Body() body: UpdatePhotoDto) {
    return this.products.updatePhoto(user.id, params.id, params.productId, params.photoId, body);
  }

  @Get(":id/products/:productId/photos/:photoId/file")
  async downloadPhoto(
    @CurrentUser() user: RequestUser,
    @Param() params: ProductPhotoParamDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.products.downloadOwnedPhoto(user.id, params.id, params.productId, params.photoId);
    if (result.kind === "redirect") {
      res.redirect(result.url);
      return;
    }
    return result.file;
  }

  @Delete(":id/products/:productId/photos/:photoId")
  removePhoto(@CurrentUser() user: RequestUser, @Param() params: ProductPhotoParamDto) {
    return this.products.removePhoto(user.id, params.id, params.productId, params.photoId);
  }
}
