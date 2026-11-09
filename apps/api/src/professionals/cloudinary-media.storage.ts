import { Injectable } from "@nestjs/common";
import { getCloudinaryConfig } from "@boutik/config";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { Readable } from "node:stream";

const CLOUDINARY_PREFIX = "cloudinary:";

export function isCloudinaryStorageKey(storageKey: string) {
  return storageKey.startsWith(CLOUDINARY_PREFIX);
}

export function cloudinaryPublicIdFromKey(storageKey: string) {
  if (!isCloudinaryStorageKey(storageKey)) return null;
  return storageKey.slice(CLOUDINARY_PREFIX.length);
}

/** URL CDN publique pour une clé `cloudinary:…` (sans Nest DI). */
export function resolveCloudinaryUrl(storageKey: string | null | undefined) {
  if (!storageKey) return null;
  const publicId = cloudinaryPublicIdFromKey(storageKey);
  if (!publicId) return null;
  const config = getCloudinaryConfig();
  if (!config.enabled) return null;
  return cloudinary.url(publicId, {
    cloud_name: config.cloudName,
    secure: true,
    resource_type: "image",
  });
}

/** Dossier boutique sous la racine Cloudinary, ex. Boutik/MEGA */
export function cloudinaryShopFolder(shopSlug: string) {
  const cleaned = shopSlug
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || "boutique";
}

@Injectable()
export class CloudinaryMediaStorage {
  private configured = false;

  isEnabled() {
    const config = getCloudinaryConfig();
    if (!config.enabled) return false;
    if (!this.configured) {
      cloudinary.config({
        cloud_name: config.cloudName,
        api_key: config.apiKey,
        api_secret: config.apiSecret,
        secure: true,
      });
      this.configured = true;
    }
    return true;
  }

  shopRoot(shopSlug: string) {
    const root = getCloudinaryConfig().folderRoot;
    return `${root}/${cloudinaryShopFolder(shopSlug)}`;
  }

  productPublicId(shopSlug: string, productId: string, photoId: string) {
    return `${this.shopRoot(shopSlug)}/products/${productId}/${photoId}`;
  }

  siteAssetPublicId(shopSlug: string, siteId: string, assetId: string) {
    return `${this.shopRoot(shopSlug)}/site/${siteId}/${assetId}`;
  }

  toStorageKey(publicId: string) {
    return `${CLOUDINARY_PREFIX}${publicId}`;
  }

  isCloudinaryKey(storageKey: string) {
    return isCloudinaryStorageKey(storageKey);
  }

  publicUrl(storageKey: string) {
    return resolveCloudinaryUrl(storageKey);
  }

  async uploadProductPhoto(input: {
    shopSlug: string;
    productId: string;
    photoId: string;
    buffer: Buffer;
    mimeType: string;
  }) {
    return this.uploadImage({
      publicId: this.productPublicId(input.shopSlug, input.productId, input.photoId),
      buffer: input.buffer,
      mimeType: input.mimeType,
    });
  }

  async uploadSiteAsset(input: {
    shopSlug: string;
    siteId: string;
    assetId: string;
    buffer: Buffer;
    mimeType: string;
  }) {
    return this.uploadImage({
      publicId: this.siteAssetPublicId(input.shopSlug, input.siteId, input.assetId),
      buffer: input.buffer,
      mimeType: input.mimeType,
    });
  }

  async uploadImage(input: { publicId: string; buffer: Buffer; mimeType: string }) {
    if (!this.isEnabled()) {
      throw new Error("Cloudinary n’est pas configuré");
    }
    const uploaded = await this.uploadBuffer(input.buffer, {
      public_id: input.publicId,
      resource_type: "image",
      overwrite: true,
      invalidate: true,
      use_filename: false,
      unique_filename: false,
      format: extensionForMime(input.mimeType),
    });
    return {
      storageKey: this.toStorageKey(uploaded.public_id),
      url: uploaded.secure_url,
      bytes: uploaded.bytes,
      mimeType: input.mimeType,
    };
  }

  async remove(storageKey: string) {
    const publicId = cloudinaryPublicIdFromKey(storageKey);
    if (!publicId || !this.isEnabled()) return;
    await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true }).catch(() => undefined);
  }

  private uploadBuffer(
    buffer: Buffer,
    options: {
      public_id: string;
      resource_type: "image";
      overwrite: boolean;
      invalidate: boolean;
      use_filename: boolean;
      unique_filename: boolean;
      format?: string;
    },
  ) {
    return new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Échec upload Cloudinary"));
          return;
        }
        resolve(result);
      });
      Readable.from(buffer).pipe(stream);
    });
  }
}

function extensionForMime(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}
