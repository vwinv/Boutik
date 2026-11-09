export type Category = "VITRINE" | "RESTAURANT" | "BOUTIQUE";

export type TenantStatus = "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";

export type SiteStatus = "DRAFT" | "PUBLISHED" | "SUSPENDED";

export type SitePublicStatus = "DRAFT" | "PUBLISHED" | "SUSPENDED" | "ARCHIVED";

export type SiteSectionType = "HERO" | "TEXT" | "IMAGE" | "BANNER" | "GALLERY" | "CONTACT" | "HOURS" | "CTA";

export const SITE_STATUSES: SiteStatus[] = ["DRAFT", "PUBLISHED", "SUSPENDED"];

export const SITE_PUBLIC_STATUSES: SitePublicStatus[] = ["DRAFT", "PUBLISHED", "SUSPENDED", "ARCHIVED"];

export const SITE_SECTION_TYPES: SiteSectionType[] = [
  "HERO",
  "TEXT",
  "IMAGE",
  "BANNER",
  "GALLERY",
  "CONTACT",
  "HOURS",
  "CTA",
];

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export const SITE_VISUAL_KINDS = ["logo", "cover", "favicon", "banner"] as const;

export type SiteVisualKind = (typeof SITE_VISUAL_KINDS)[number];

export type DocumentKind = "IDENTITY" | "NINEA" | "RCCM" | "OTHER";

export const DOCUMENT_KINDS: DocumentKind[] = ["IDENTITY", "NINEA", "RCCM", "OTHER"];

export const TENANT_STATUSES: TenantStatus[] = ["DRAFT", "ACTIVE", "SUSPENDED", "ARCHIVED"];

export type MembershipRole = "OWNER" | "MANAGER" | "STAFF";

export type StaffRole = "NONE" | "SUPPORT" | "FINANCE" | "MODERATION" | "ADMIN" | "OWNER";

export const STAFF_ROLES: Exclude<StaffRole, "NONE">[] = [
  "SUPPORT",
  "FINANCE",
  "MODERATION",
  "ADMIN",
  "OWNER",
];

export const STAFF_INVITE_ROLES: Exclude<StaffRole, "NONE" | "ADMIN">[] = [
  "SUPPORT",
  "FINANCE",
  "MODERATION",
  "OWNER",
];

export type Capability =
  | "pages"
  | "gallery"
  | "contact"
  | "seo"
  | "theme"
  | "menu"
  | "hours"
  | "reservations"
  | "click_collect"
  | "catalog"
  | "cart"
  | "checkout"
  | "stock"
  | "orders"
  | "wallet"
  | "customers";

export type Audience = "staff" | "pro" | "storefront";

export type BillingInterval = "MONTHLY" | "YEARLY";

export const BILLING_INTERVALS: BillingInterval[] = ["MONTHLY", "YEARLY"];

export type ProductAvailability = "IN_STOCK" | "OUT_OF_STOCK" | "MADE_TO_ORDER";

export const PRODUCT_AVAILABILITIES: ProductAvailability[] = ["IN_STOCK", "OUT_OF_STOCK", "MADE_TO_ORDER"];

export type ReservationStatus = "PENDING" | "CONFIRMED" | "SEATED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export const RESERVATION_STATUSES: ReservationStatus[] = [
  "PENDING",
  "CONFIRMED",
  "SEATED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

export const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = ["PENDING", "CONFIRMED", "SEATED"];

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "PICKED_UP"
  | "CANCELLED";

export const ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "PICKED_UP",
  "CANCELLED",
];

export type FulfillmentMethod = "DELIVERY" | "PICKUP";

export const FULFILLMENT_METHODS: FulfillmentMethod[] = ["DELIVERY", "PICKUP"];

export type SubscriptionRestriction = "NONE" | "READ_ONLY";

export const SUBSCRIPTION_RESTRICTIONS: SubscriptionRestriction[] = ["NONE", "READ_ONLY"];

export type PaymentStatus = "PENDING" | "VALIDATED" | "FAILED";

export const PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "VALIDATED", "FAILED"];

export type PaymentMethod = "CASH" | "TRANSFER" | "MOBILE_MONEY" | "OTHER";

export const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "TRANSFER", "MOBILE_MONEY", "OTHER"];

export type SubscriptionAccess = "ACTIVE" | "GRACE" | "EXPIRED";

export const CAPABILITIES: Capability[] = [
  "pages",
  "gallery",
  "contact",
  "seo",
  "theme",
  "menu",
  "hours",
  "reservations",
  "click_collect",
  "catalog",
  "cart",
  "checkout",
  "stock",
  "orders",
  "wallet",
  "customers",
];
