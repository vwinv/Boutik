import { Body, Controller, Get, Param, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import type { RequestUser } from "../auth/auth.types";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import {
  CreateProductReviewDto,
  StorefrontCatalogQueryDto,
  StorefrontPhotoParamDto,
  StorefrontProductParamDto,
} from "./dto/product.dto";
import { ProductsService } from "./products.service";

@Controller("storefront")
export class StorefrontCatalogController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get("catalog")
  catalog(@Query() query: StorefrontCatalogQueryDto) {
    return this.products.publicCatalog(query);
  }

  @Public()
  @Get("catalog/:productSlug")
  product(@Query() query: StorefrontCatalogQueryDto, @Param() params: StorefrontProductParamDto) {
    return this.products.publicProduct(query, params.productSlug);
  }

  @Public()
  @Get("catalog/:productSlug/photos/:photoId")
  async photo(
    @Query() query: StorefrontCatalogQueryDto,
    @Param() params: StorefrontPhotoParamDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.products.downloadPublicPhoto(query, params.productSlug, params.photoId);
    if (result.kind === "redirect") {
      res.redirect(result.url);
      return;
    }
    return result.file;
  }

  @Public()
  @Get("catalog/:productSlug/reviews")
  reviews(@Query() query: StorefrontCatalogQueryDto, @Param() params: StorefrontProductParamDto) {
    return this.products.publicReviews(query, params.productSlug);
  }

  @RequireAudience("storefront")
  @Post("catalog/:productSlug/reviews")
  createReview(
    @CurrentUser() user: RequestUser,
    @Query() query: StorefrontCatalogQueryDto,
    @Param() params: StorefrontProductParamDto,
    @Body() body: CreateProductReviewDto,
  ) {
    return this.products.createPublicReview(query, params.productSlug, body, user.id);
  }
}
