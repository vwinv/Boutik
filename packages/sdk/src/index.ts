import { getApiUrl } from "@boutik/config";
import {
  API_ERROR_CODES,
  type ApiErrorBody,
  type ApiErrorCode,
  type ApiResponse,
  type Capability,
  type Category,
  type TenantStatus,
} from "@boutik/domain";

export type TenantPublic = {
  id: string;
  slug: string;
  name: string;
  category: Category;
  status: TenantStatus;
  capabilities: Capability[];
  description?: string | null;
  timezone?: string;
  locale?: string;
  currency?: string;
  contact?: {
    city?: string | null;
    country?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    addressLine?: string | null;
  };
  site?: TenantSitePublic | null;
};

export type TenantSitePublic = {
  id: string;
  slug: string;
  host: string;
  url: string;
  status: string;
  category: Category;
  general: {
    title: string;
    tagline: string | null;
    about: string | null;
  };
  theme: {
    layoutKey: string | null;
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
    logoUrl: string | null;
    coverUrl: string | null;
    bannerUrl: string | null;
    faviconUrl: string | null;
  };
  contact: {
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    addressLine: string | null;
    city: string | null;
  };
  social?: {
    facebookUrl: string | null;
    instagramUrl: string | null;
    tiktokUrl: string | null;
    youtubeUrl?: string | null;
    linkedinUrl?: string | null;
    xUrl?: string | null;
  };
  hours: Array<{
    weekday: number;
    opensAt: string | null;
    closesAt: string | null;
    isClosed: boolean;
  }>;
  pages: Array<{
    slug: string;
    title: string;
    isHome: boolean;
    sections: Array<{
      type: string;
      title: string | null;
      body: string | null;
      imageUrl: string | null;
    }>;
  }>;
};

export type StorefrontVariant = {
  id: string;
  name: string;
  sku: string | null;
  priceXof: number | null;
  availability: string;
  stockQty?: number | null;
  option1Kind?: string | null;
  option1Value?: string | null;
  option2Kind?: string | null;
  option2Value?: string | null;
  options?: Array<{ kind: string; value: string }>;
  sortOrder: number;
};

export type StorefrontProduct = {
  slug: string;
  name: string;
  description: string | null;
  priceXof: number;
  compareAtPriceXof: number | null;
  currency: string;
  availability: string;
  isFeatured?: boolean;
  sortOrder: number;
  category: { slug: string; name: string } | null;
  variants?: StorefrontVariant[];
  photos: Array<{
    id: string;
    alt: string | null;
    url: string;
    optionKind?: string | null;
    optionValue?: string | null;
    sortOrder: number;
  }>;
};

export type StorefrontCatalog = {
  slug: string;
  currency: string;
  categories: Array<{
    slug: string;
    name: string;
    description: string | null;
    sortOrder: number;
    products: StorefrontProduct[];
  }>;
  products: StorefrontProduct[];
};

export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(error: ApiErrorBody, status: number) {
    super(error.message);
    this.name = "ApiClientError";
    this.code = error.code;
    this.status = status;
    this.details = error.details;
  }
}

export function apiPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getApiUrl()}/api${normalized}`;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiPath(path), {
    cache: "no-store",
    ...init,
  });

  let body: ApiResponse<T> | undefined;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(
      { code: API_ERROR_CODES.INTERNAL_ERROR, message: "Réponse API invalide" },
      response.status,
    );
  }

  if (!body || typeof body !== "object" || typeof body.ok !== "boolean") {
    throw new ApiClientError(
      { code: API_ERROR_CODES.INTERNAL_ERROR, message: "Réponse API invalide" },
      response.status,
    );
  }

  if (!body.ok) {
    throw new ApiClientError(body.error, response.status);
  }

  return body.data;
}

export async function fetchTenants(init?: RequestInit) {
  return apiRequest<TenantPublic[]>("/tenants", init);
}

export async function fetchTenantBySlug(slug: string, init?: RequestInit): Promise<TenantPublic | null> {
  try {
    return await apiRequest<TenantPublic>(`/tenants/by-slug/${slug}`, init);
  } catch (error) {
    if (error instanceof ApiClientError && error.code === API_ERROR_CODES.TENANT_NOT_FOUND) {
      return null;
    }

    throw error;
  }
}

export async function fetchStorefrontCatalog(slug: string, init?: RequestInit): Promise<StorefrontCatalog> {
  return apiRequest<StorefrontCatalog>(`/storefront/catalog?slug=${encodeURIComponent(slug)}`, init);
}

export async function fetchStorefrontProduct(
  slug: string,
  productSlug: string,
  init?: RequestInit,
): Promise<StorefrontProduct | null> {
  try {
    return await apiRequest<StorefrontProduct>(
      `/storefront/catalog/${encodeURIComponent(productSlug)}?slug=${encodeURIComponent(slug)}`,
      init,
    );
  } catch (error) {
    if (
      error instanceof ApiClientError &&
      (error.status === 404 || error.code === API_ERROR_CODES.PRODUCT_NOT_FOUND)
    ) {
      return null;
    }
    throw error;
  }
}
