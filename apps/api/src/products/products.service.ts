import { Injectable, StreamableFile } from "@nestjs/common";
import {
  API_ERROR_CODES,
  nextAvailableSlug,
  sitePublicStatus,
  slugifyName,
  tenantSlugFromHost,
} from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { assertOfferingCapability, offeringHasCapability } from "../catalog/effective-capabilities";
import { assertCatalogItemQuota } from "../catalog/plan-limits";
import { PrismaService } from "../prisma/prisma.service";
import { CloudinaryMediaStorage } from "../professionals/cloudinary-media.storage";
import { DocumentsStorage } from "../professionals/documents.storage";
import { TenantAccessService } from "../professionals/tenant-access.service";
import { workspaceWithRelations, type WorkspaceRecord } from "../professionals/workspace.presenter";
import type {
  CreateProductCategoryDto,
  CreateProductDto,
  CreateProductReviewDto,
  CreateVariantDto,
  ReorderDto,
  UpdatePhotoDto,
  UpdateProductCategoryDto,
  UpdateProductDto,
  UpdateVariantDto,
} from "./dto/product.dto";
import {
  presentCategory,
  presentPhoto,
  presentProduct,
  presentPublicProduct,
  productInclude,
  type ProductRecord,
} from "./product.presenter";

const MAX_PHOTOS = 16;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function presentReview(review: {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  createdAt: Date;
}) {
  return {
    id: review.id,
    authorName: review.authorName,
    rating: review.rating,
    body: review.body,
    createdAt: review.createdAt.toISOString(),
  };
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
    private readonly storage: DocumentsStorage,
    private readonly cloudinary: CloudinaryMediaStorage,
  ) { }

  async listCategories(userId: string, tenantId: string) {
    const tenant = await this.requireCatalog(userId, tenantId);
    const categories = await this.prisma.productCategory.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return categories.map(presentCategory);
  }

  async createCategory(userId: string, tenantId: string, input: CreateProductCategoryDto) {
    const tenant = await this.requireCatalog(userId, tenantId, { mutate: true });
    const slug = await this.uniqueCategorySlug(tenant.id, input.slug ?? input.name);
    const count = await this.prisma.productCategory.count({ where: { tenantId: tenant.id } });
    const category = await this.prisma.productCategory.create({
      data: {
        tenantId: tenant.id,
        slug,
        name: input.name,
        description: input.description,
        sortOrder: input.sortOrder ?? count,
        isActive: input.isActive ?? true,
      },
    });
    return presentCategory(category);
  }

  async updateCategory(userId: string, tenantId: string, categoryId: string, input: UpdateProductCategoryDto) {
    const tenant = await this.requireCatalog(userId, tenantId, { mutate: true });
    const category = await this.requireCategory(tenant.id, categoryId);
    const slug =
      input.slug && input.slug !== category.slug
        ? await this.uniqueCategorySlug(tenant.id, input.slug, category.id)
        : undefined;
    return presentCategory(
      await this.prisma.productCategory.update({
        where: { id: category.id },
        data: {
          slug,
          name: input.name,
          description: input.description,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        },
      }),
    );
  }

  async removeCategory(userId: string, tenantId: string, categoryId: string) {
    const tenant = await this.requireCatalog(userId, tenantId, { mutate: true });
    const category = await this.requireCategory(tenant.id, categoryId);
    await this.prisma.productCategory.delete({ where: { id: category.id } });
    return { deleted: true };
  }

  async reorderCategories(userId: string, tenantId: string, input: ReorderDto) {
    const tenant = await this.requireCatalog(userId, tenantId, { mutate: true });
    await this.reorder("productCategory", tenant.id, input.ids);
    return this.listCategories(userId, tenant.id);
  }

  async listProducts(userId: string, tenantId: string) {
    const tenant = await this.requireCatalog(userId, tenantId);
    const products = await this.prisma.product.findMany({
      where: { tenantId: tenant.id },
      include: productInclude,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return products.map((product) => this.presentOwned(tenant, product));
  }

  async getProduct(userId: string, tenantId: string, productId: string) {
    const tenant = await this.requireCatalog(userId, tenantId);
    return this.presentOwned(tenant, await this.requireProduct(tenant.id, productId));
  }

  async createProduct(userId: string, tenantId: string, input: CreateProductDto) {
    const tenant = await this.requireCatalog(userId, tenantId, { mutate: true });
    if (input.categoryId) {
      await this.requireCategory(tenant.id, input.categoryId);
    }
    const slug = await this.uniqueProductSlug(tenant.id, input.slug ?? input.name);
    const count = await this.prisma.product.count({ where: { tenantId: tenant.id } });
    assertCatalogItemQuota(tenant, count);
    const stockQty = input.stockQty === undefined ? undefined : input.stockQty;
    const availability =
      input.availability ??
      (stockQty === 0 ? "OUT_OF_STOCK" : stockQty == null ? "IN_STOCK" : "IN_STOCK");
    const product = await this.prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: input.categoryId,
        slug,
        name: input.name,
        description: input.description,
        priceXof: input.priceXof,
        compareAtPriceXof: input.compareAtPriceXof,
        availability,
        stockQty: stockQty ?? null,
        lowStockThreshold: input.lowStockThreshold ?? null,
        isFeatured: input.isFeatured ?? false,
        isActive: input.isActive ?? true,
        isPublished: input.isPublished ?? false,
        sortOrder: input.sortOrder ?? count,
      },
      include: productInclude,
    });
    return this.presentOwned(tenant, product);
  }

  async updateProduct(userId: string, tenantId: string, productId: string, input: UpdateProductDto) {
    const tenant = await this.requireCatalog(userId, tenantId, { mutate: true });
    const product = await this.requireProduct(tenant.id, productId);
    if (input.categoryId) {
      await this.requireCategory(tenant.id, input.categoryId);
    }
    const slug =
      input.slug && input.slug !== product.slug
        ? await this.uniqueProductSlug(tenant.id, input.slug, product.id)
        : undefined;
    const nextStock = input.stockQty === undefined ? product.stockQty : input.stockQty;
    const availability =
      input.availability ??
      (nextStock === 0 ? "OUT_OF_STOCK" : input.stockQty !== undefined ? "IN_STOCK" : undefined);
    const updated = await this.prisma.product.update({
      where: { id: product.id },
      data: {
        slug,
        name: input.name,
        description: input.description,
        priceXof: input.priceXof,
        compareAtPriceXof: input.compareAtPriceXof,
        availability,
        stockQty: input.stockQty === undefined ? undefined : input.stockQty,
        lowStockThreshold: input.lowStockThreshold === undefined ? undefined : input.lowStockThreshold,
        isFeatured: input.isFeatured,
        categoryId: input.categoryId === undefined ? undefined : input.categoryId,
        isActive: input.isActive,
        isPublished: input.isPublished,
        sortOrder: input.sortOrder,
      },
      include: productInclude,
    });
    return this.presentOwned(tenant, updated);
  }

  async setActive(userId: string, tenantId: string, productId: string, isActive: boolean) {
    return this.updateProduct(userId, tenantId, productId, { isActive });
  }

  async removeProduct(userId: string, tenantId: string, productId: string) {
    const tenant = await this.requireCatalog(userId, tenantId, { mutate: true });
    const product = await this.requireProduct(tenant.id, productId);
    for (const photo of product.photos) {
      await this.removeStoredPhoto(photo.storageKey);
    }
    await this.prisma.product.delete({ where: { id: product.id } });
    return { deleted: true };
  }

  async reorderProducts(userId: string, tenantId: string, input: ReorderDto) {
    const tenant = await this.requireCatalog(userId, tenantId, { mutate: true });
    await this.reorder("product", tenant.id, input.ids);
    return this.listProducts(userId, tenant.id);
  }

  async createVariant(userId: string, tenantId: string, productId: string, input: CreateVariantDto) {
    const tenant = await this.requireCatalog(userId, tenantId, { mutate: true });
    const product = await this.requireProduct(tenant.id, productId);
    const stockQty = input.stockQty ?? null;
    const options =
      input.options?.map((item) => ({ kind: item.kind, value: item.value })) ??
      ([
        input.option1Kind && input.option1Value ? { kind: input.option1Kind, value: input.option1Value } : null,
        input.option2Kind && input.option2Value ? { kind: input.option2Kind, value: input.option2Value } : null,
      ].filter(Boolean) as Array<{ kind: string; value: string }>);
    await this.prisma.productVariant.create({
      data: {
        productId: product.id,
        name: input.name,
        sku: input.sku,
        priceXof: input.priceXof,
        availability: input.availability ?? (stockQty === 0 ? "OUT_OF_STOCK" : "IN_STOCK"),
        stockQty,
        lowStockThreshold: input.lowStockThreshold ?? null,
        option1Kind: options[0]?.kind ?? input.option1Kind ?? null,
        option1Value: options[0]?.value ?? input.option1Value ?? null,
        option2Kind: options[1]?.kind ?? input.option2Kind ?? null,
        option2Value: options[1]?.value ?? input.option2Value ?? null,
        options,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? product.variants.length,
      },
    });
    return this.presentOwned(tenant, await this.requireProduct(tenant.id, product.id));
  }

  async updateVariant(userId: string, tenantId: string, productId: string, variantId: string, input: UpdateVariantDto) {
    const tenant = await this.requireCatalog(userId, tenantId, { mutate: true });
    const product = await this.requireProduct(tenant.id, productId);
    const variant = product.variants.find((item) => item.id === variantId);
    if (!variant) {
      throw new ApiException(API_ERROR_CODES.VARIANT_NOT_FOUND);
    }
    const stockQty = input.stockQty === undefined ? undefined : input.stockQty;
    const options =
      input.options === undefined
        ? undefined
        : input.options.map((item) => ({ kind: item.kind, value: item.value }));
    await this.prisma.productVariant.update({
      where: { id: variant.id },
      data: {
        name: input.name,
        sku: input.sku,
        priceXof: input.priceXof,
        availability:
          input.availability !== undefined
            ? input.availability
            : stockQty === 0
              ? "OUT_OF_STOCK"
              : stockQty == null
                ? undefined
                : "IN_STOCK",
        stockQty: input.stockQty,
        lowStockThreshold: input.lowStockThreshold,
        option1Kind: options ? (options[0]?.kind ?? null) : input.option1Kind,
        option1Value: options ? (options[0]?.value ?? null) : input.option1Value,
        option2Kind: options ? (options[1]?.kind ?? null) : input.option2Kind,
        option2Value: options ? (options[1]?.value ?? null) : input.option2Value,
        ...(options !== undefined ? { options } : {}),
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      },
    });
    return this.presentOwned(tenant, await this.requireProduct(tenant.id, product.id));
  }

  async removeVariant(userId: string, tenantId: string, productId: string, variantId: string) {
    const tenant = await this.requireCatalog(userId, tenantId, { mutate: true });
    const product = await this.requireProduct(tenant.id, productId);
    const variant = product.variants.find((item) => item.id === variantId);
    if (!variant) {
      throw new ApiException(API_ERROR_CODES.VARIANT_NOT_FOUND);
    }
    await this.prisma.productVariant.delete({ where: { id: variant.id } });
    return this.presentOwned(tenant, await this.requireProduct(tenant.id, product.id));
  }

  async addPhoto(
    userId: string,
    tenantId: string,
    productId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    alt?: string,
    option?: { kind?: string | null; value?: string | null },
  ) {
    const tenant = await this.requireCatalog(userId, tenantId, { mutate: true });
    const product = await this.requireProduct(tenant.id, productId);
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Format de photo non accepté (JPEG, PNG, WebP)");
    }
    if (product.photos.length >= MAX_PHOTOS) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Nombre maximal de photos atteint");
    }
    const optionKind = option?.kind?.trim() || null;
    const optionValue = option?.value?.trim() || null;
    if ((optionKind && !optionValue) || (!optionKind && optionValue)) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "optionKind et optionValue doivent être fournis ensemble");
    }

    const photo = await this.prisma.productPhoto.create({
      data: {
        productId: product.id,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey: "pending",
        alt,
        optionKind,
        optionValue,
        sortOrder: product.photos.length,
      },
    });

    let storageKey: string;
    try {
      if (this.cloudinary.isEnabled()) {
        const uploaded = await this.cloudinary.uploadProductPhoto({
          shopSlug: tenant.slug,
          productId: product.id,
          photoId: photo.id,
          buffer: file.buffer,
          mimeType: file.mimetype,
        });
        storageKey = uploaded.storageKey;
      } else {
        storageKey = this.storage.key(`${tenant.id}/products/${product.id}`, photo.id, file.originalname);
        await this.storage.save(storageKey, file.buffer);
      }
    } catch (error) {
      await this.prisma.productPhoto.delete({ where: { id: photo.id } });
      throw error;
    }

    const saved = await this.prisma.productPhoto.update({
      where: { id: photo.id },
      data: { storageKey },
    });
    return presentPhoto(saved, this.resolvePhotoUrl(tenant, product.id, product.slug, saved));
  }

  async updatePhoto(userId: string, tenantId: string, productId: string, photoId: string, input: UpdatePhotoDto) {
    const tenant = await this.requireCatalog(userId, tenantId, { mutate: true });
    const product = await this.requireProduct(tenant.id, productId);
    const photo = product.photos.find((item) => item.id === photoId);
    if (!photo) {
      throw new ApiException(API_ERROR_CODES.PHOTO_NOT_FOUND);
    }
    const updated = await this.prisma.productPhoto.update({
      where: { id: photo.id },
      data: {
        alt: input.alt,
        sortOrder: input.sortOrder,
        optionKind: input.optionKind,
        optionValue: input.optionValue,
      },
    });
    return presentPhoto(updated, this.resolvePhotoUrl(tenant, product.id, product.slug, updated));
  }

  async removePhoto(userId: string, tenantId: string, productId: string, photoId: string) {
    const tenant = await this.requireCatalog(userId, tenantId, { mutate: true });
    const product = await this.requireProduct(tenant.id, productId);
    const photo = product.photos.find((item) => item.id === photoId);
    if (!photo) {
      throw new ApiException(API_ERROR_CODES.PHOTO_NOT_FOUND);
    }
    await this.removeStoredPhoto(photo.storageKey);
    await this.prisma.productPhoto.delete({ where: { id: photo.id } });
    return { deleted: true };
  }

  async downloadOwnedPhoto(userId: string, tenantId: string, productId: string, photoId: string) {
    const tenant = await this.requireCatalog(userId, tenantId);
    const product = await this.requireProduct(tenant.id, productId);
    const photo = product.photos.find((item) => item.id === photoId);
    if (!photo || photo.storageKey === "pending") {
      throw new ApiException(API_ERROR_CODES.PHOTO_NOT_FOUND);
    }
    const remote = this.cloudinary.publicUrl(photo.storageKey);
    if (remote) {
      return { kind: "redirect" as const, url: remote };
    }
    return { kind: "file" as const, file: this.streamPhoto(photo) };
  }

  async reorderPhotos(userId: string, tenantId: string, productId: string, input: ReorderDto) {
    const tenant = await this.requireCatalog(userId, tenantId, { mutate: true });
    const product = await this.requireProduct(tenant.id, productId);
    const known = new Set(product.photos.map((item) => item.id));
    if (input.ids.some((id) => !known.has(id))) {
      throw new ApiException(API_ERROR_CODES.PHOTO_NOT_FOUND);
    }
    await this.prisma.$transaction(
      input.ids.map((id, index) => this.prisma.productPhoto.update({ where: { id }, data: { sortOrder: index } })),
    );
    return this.presentOwned(tenant, await this.requireProduct(tenant.id, product.id));
  }

  async publicCatalog(input: { slug?: string; host?: string }) {
    const tenant = await this.requirePublicStorefront(input);
    if (!offeringHasCapability(tenant, "catalog") && !offeringHasCapability(tenant, "menu")) {
      return { slug: tenant.slug, currency: tenant.currency, categories: [], products: [] };
    }

    const products = await this.prisma.product.findMany({
      where: { tenantId: tenant.id, isActive: true, isPublished: true },
      include: productInclude,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    const categories = await this.prisma.productCategory.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    const presented = products.map((product) =>
      presentPublicProduct(product, {
        currency: tenant.currency,
        photoUrl: (photo) => this.publicPhotoUrl(tenant.slug, product.slug, photo.id, photo.storageKey),
      }),
    );

    return {
      slug: tenant.slug,
      currency: tenant.currency,
      categories: categories
        .map((category) => ({
          slug: category.slug,
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
          products: presented.filter((product) => product.category?.slug === category.slug),
        }))
        .filter((category) => category.products.length > 0),
      products: presented,
    };
  }

  async publicProduct(input: { slug?: string; host?: string }, productSlug: string) {
    const tenant = await this.requirePublicStorefront(input);
    if (!offeringHasCapability(tenant, "catalog")) {
      throw new ApiException(API_ERROR_CODES.PRODUCT_NOT_FOUND);
    }
    const product = await this.prisma.product.findFirst({
      where: { tenantId: tenant.id, slug: productSlug, isActive: true, isPublished: true },
      include: productInclude,
    });
    if (!product) {
      throw new ApiException(API_ERROR_CODES.PRODUCT_NOT_FOUND);
    }
    return presentPublicProduct(product, {
      currency: tenant.currency,
      photoUrl: (photo) => this.publicPhotoUrl(tenant.slug, product.slug, photo.id, photo.storageKey),
    });
  }

  async downloadPublicPhoto(input: { slug?: string; host?: string }, productSlug: string, photoId: string) {
    const tenant = await this.requirePublicStorefront(input);
    const product = await this.prisma.product.findFirst({
      where: { tenantId: tenant.id, slug: productSlug, isActive: true, isPublished: true },
      include: { photos: true },
    });
    const photo = product?.photos.find((item) => item.id === photoId);
    if (!photo || photo.storageKey === "pending") {
      throw new ApiException(API_ERROR_CODES.PHOTO_NOT_FOUND);
    }
    const remote = this.cloudinary.publicUrl(photo.storageKey);
    if (remote) {
      return { kind: "redirect" as const, url: remote };
    }
    return { kind: "file" as const, file: this.streamPhoto(photo) };
  }

  async publicReviews(input: { slug?: string; host?: string }, productSlug: string) {
    const tenant = await this.requirePublicStorefront(input);
    const enabled = await this.reviewsEnabled(tenant.id);
    if (!enabled) {
      return { enabled: false, average: null, count: 0, reviews: [] as Array<ReturnType<typeof presentReview>> };
    }
    const product = await this.requirePublicProduct(tenant.id, productSlug);
    const reviews = await this.prisma.productReview.findMany({
      where: { productId: product.id, isPublished: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const count = reviews.length;
    const average = count ? Math.round((reviews.reduce((sum, item) => sum + item.rating, 0) / count) * 10) / 10 : null;
    return {
      enabled: true,
      average,
      count,
      reviews: reviews.map(presentReview),
    };
  }

  async createPublicReview(
    input: { slug?: string; host?: string },
    productSlug: string,
    body: CreateProductReviewDto,
    userId?: string | null,
  ) {
    const tenant = await this.requirePublicStorefront(input);
    const enabled = await this.reviewsEnabled(tenant.id);
    if (!enabled) {
      throw new ApiException(API_ERROR_CODES.FORBIDDEN, "Les avis clients ne sont pas activés sur ce site");
    }
    const product = await this.requirePublicProduct(tenant.id, productSlug);
    const authorName = body.authorName.trim();
    const text = body.body.trim();
    if (userId) {
      const existing = await this.prisma.productReview.findFirst({
        where: { productId: product.id, userId },
      });
      if (existing) {
        const updated = await this.prisma.productReview.update({
          where: { id: existing.id },
          data: {
            authorName,
            rating: body.rating,
            body: text,
            isPublished: true,
          },
        });
        return presentReview(updated);
      }
    }
    const created = await this.prisma.productReview.create({
      data: {
        tenantId: tenant.id,
        productId: product.id,
        userId: userId || null,
        authorName,
        rating: body.rating,
        body: text,
      },
    });
    return presentReview(created);
  }

  private async reviewsEnabled(tenantId: string) {
    const site = await this.prisma.tenantSite.findUnique({
      where: { tenantId },
      include: {
        pages: {
          where: { isHome: true, isVisible: true },
          include: { sections: { where: { isVisible: true } } },
        },
      },
    });
    const sections = site?.pages.flatMap((page) => page.sections) ?? [];
    return sections.some((section) => /^@boutik-block:reviews\b/m.test(section.body || ""));
  }

  private async requirePublicProduct(tenantId: string, productSlug: string) {
    const product = await this.prisma.product.findFirst({
      where: { tenantId, slug: productSlug, isActive: true, isPublished: true },
    });
    if (!product) {
      throw new ApiException(API_ERROR_CODES.PRODUCT_NOT_FOUND);
    }
    return product;
  }

  private streamPhoto(photo: { storageKey: string; mimeType: string; originalName: string }) {
    return new StreamableFile(this.storage.stream(photo.storageKey), {
      type: photo.mimeType,
      disposition: `inline; filename="${photo.originalName.replaceAll('"', "")}"`,
    });
  }

  private async requireCatalog(userId: string, tenantId: string, options?: { mutate?: boolean }) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId, options);
    if (!offeringHasCapability(tenant, "catalog") && !offeringHasCapability(tenant, "menu")) {
      assertOfferingCapability(tenant, "catalog");
    }
    return tenant;
  }

  private async requirePublicStorefront(input: { slug?: string; host?: string }) {
    const slug = input.slug?.trim().toLowerCase() || tenantSlugFromHost(input.host);
    if (!slug) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Indiquez un slug ou un sous-domaine");
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      include: { ...workspaceWithRelations, site: true },
    });
    if (!tenant?.site) {
      throw new ApiException(API_ERROR_CODES.SITE_NOT_FOUND, undefined, { slug });
    }
    const status = sitePublicStatus(tenant.status, tenant.site.status);
    if (status === "ARCHIVED") {
      throw new ApiException(API_ERROR_CODES.TENANT_NOT_FOUND, undefined, { slug });
    }
    if (status === "SUSPENDED") {
      throw new ApiException(API_ERROR_CODES.TENANT_SUSPENDED, undefined, { slug });
    }
    if (status !== "PUBLISHED") {
      throw new ApiException(API_ERROR_CODES.SITE_NOT_FOUND, undefined, { slug });
    }
    return tenant;
  }

  private async requireCategory(tenantId: string, categoryId: string) {
    const category = await this.prisma.productCategory.findFirst({ where: { id: categoryId, tenantId } });
    if (!category) {
      throw new ApiException(API_ERROR_CODES.PRODUCT_CATEGORY_NOT_FOUND);
    }
    return category;
  }

  private async requireProduct(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: productInclude,
    });
    if (!product) {
      throw new ApiException(API_ERROR_CODES.PRODUCT_NOT_FOUND);
    }
    return product;
  }

  private async uniqueCategorySlug(tenantId: string, raw: string, excludeId?: string) {
    return this.uniqueScopedSlug(raw, excludeId, async () => {
      const rows = await this.prisma.productCategory.findMany({
        where: { tenantId },
        select: { id: true, slug: true },
      });
      return rows;
    });
  }

  private async uniqueProductSlug(tenantId: string, raw: string, excludeId?: string) {
    return this.uniqueScopedSlug(raw, excludeId, async () => {
      const rows = await this.prisma.product.findMany({
        where: { tenantId },
        select: { id: true, slug: true },
      });
      return rows;
    });
  }

  private async uniqueScopedSlug(
    raw: string,
    excludeId: string | undefined,
    load: () => Promise<Array<{ id: string; slug: string }>>,
  ) {
    const base = slugifyName(raw);
    if (!base) {
      throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "Slug invalide");
    }
    const rows = await load();
    const taken = new Set(rows.filter((row) => row.id !== excludeId).map((row) => row.slug));
    if (!taken.has(base)) {
      return base;
    }
    const next = nextAvailableSlug(base, taken);
    if (!next) {
      throw new ApiException(API_ERROR_CODES.CONFLICT, "Impossible de générer un slug disponible");
    }
    return next;
  }

  private async reorder(model: "product" | "productCategory", tenantId: string, ids: string[]) {
    const rows =
      model === "product"
        ? await this.prisma.product.findMany({ where: { tenantId }, select: { id: true } })
        : await this.prisma.productCategory.findMany({ where: { tenantId }, select: { id: true } });
    const known = new Set(rows.map((row) => row.id));
    if (ids.some((id) => !known.has(id))) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Identifiant inconnu dans ce catalogue");
    }
    await this.prisma.$transaction(
      ids.map((id, index) =>
        model === "product"
          ? this.prisma.product.update({ where: { id }, data: { sortOrder: index } })
          : this.prisma.productCategory.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
  }

  private presentOwned(tenant: Pick<WorkspaceRecord, "id" | "currency" | "slug">, product: ProductRecord) {
    return presentProduct(product, {
      currency: tenant.currency,
      photoUrl: (photo) => this.resolvePhotoUrl(tenant, product.id, product.slug, photo),
    });
  }

  private resolvePhotoUrl(
    tenant: Pick<WorkspaceRecord, "id" | "slug">,
    productId: string,
    _productSlug: string,
    photo: { id: string; storageKey: string },
  ) {
    const remote = this.cloudinary.publicUrl(photo.storageKey);
    if (remote) return remote;
    return this.ownedPhotoUrl(tenant.id, productId, photo.id);
  }

  private async removeStoredPhoto(storageKey: string) {
    if (this.cloudinary.isCloudinaryKey(storageKey)) {
      await this.cloudinary.remove(storageKey);
      return;
    }
    await this.storage.remove(storageKey);
  }

  private ownedPhotoUrl(tenantId: string, productId: string, photoId: string) {
    return `/api/workspaces/${tenantId}/products/${productId}/photos/${photoId}/file`;
  }

  private publicPhotoUrl(slug: string, productSlug: string, photoId: string, storageKey?: string) {
    if (storageKey) {
      const remote = this.cloudinary.publicUrl(storageKey);
      if (remote) return remote;
    }
    return `/api/storefront/catalog/${productSlug}/photos/${photoId}?slug=${encodeURIComponent(slug)}`;
  }
}
