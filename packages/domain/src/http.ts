export const API_ERROR_CODES = {
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  TENANT_NOT_FOUND: "TENANT_NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
  INVALID_TOKEN: "INVALID_TOKEN",
  CUSTOMERS_NOT_ALLOWED: "CUSTOMERS_NOT_ALLOWED",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  PROFESSIONAL_NOT_FOUND: "PROFESSIONAL_NOT_FOUND",
  DOCUMENT_NOT_FOUND: "DOCUMENT_NOT_FOUND",
  TENANT_SUSPENDED: "TENANT_SUSPENDED",
  TENANT_ARCHIVED: "TENANT_ARCHIVED",
  TENANT_NOT_READY: "TENANT_NOT_READY",
  PLAN_NOT_FOUND: "PLAN_NOT_FOUND",
  TEMPLATE_NOT_FOUND: "TEMPLATE_NOT_FOUND",
  SUBCATEGORY_NOT_FOUND: "SUBCATEGORY_NOT_FOUND",
  OPTION_NOT_FOUND: "OPTION_NOT_FOUND",
  CATEGORY_MISMATCH: "CATEGORY_MISMATCH",
  PREMIUM_TEMPLATE_FORBIDDEN: "PREMIUM_TEMPLATE_FORBIDDEN",
  CAPABILITY_NOT_ALLOWED: "CAPABILITY_NOT_ALLOWED",
  PLAN_LIMIT_REACHED: "PLAN_LIMIT_REACHED",
  SITE_NOT_FOUND: "SITE_NOT_FOUND",
  SITE_NOT_READY: "SITE_NOT_READY",
  PAGE_NOT_FOUND: "PAGE_NOT_FOUND",
  SECTION_NOT_FOUND: "SECTION_NOT_FOUND",
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  PRODUCT_CATEGORY_NOT_FOUND: "PRODUCT_CATEGORY_NOT_FOUND",
  VARIANT_NOT_FOUND: "VARIANT_NOT_FOUND",
  PHOTO_NOT_FOUND: "PHOTO_NOT_FOUND",
  RESERVATION_NOT_FOUND: "RESERVATION_NOT_FOUND",
  SLOT_UNAVAILABLE: "SLOT_UNAVAILABLE",
  RESERVATIONS_DISABLED: "RESERVATIONS_DISABLED",
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
  ORDERS_DISABLED: "ORDERS_DISABLED",
  FULFILLMENT_UNAVAILABLE: "FULFILLMENT_UNAVAILABLE",
  PRODUCT_UNAVAILABLE: "PRODUCT_UNAVAILABLE",
  MIN_ORDER_NOT_MET: "MIN_ORDER_NOT_MET",
  SUBSCRIPTION_NOT_FOUND: "SUBSCRIPTION_NOT_FOUND",
  SUBSCRIPTION_EXPIRED: "SUBSCRIPTION_EXPIRED",
  PAYMENT_NOT_FOUND: "PAYMENT_NOT_FOUND",
  RECEIPT_NOT_FOUND: "RECEIPT_NOT_FOUND",
  PAYMENT_PROVIDER_UNAVAILABLE: "PAYMENT_PROVIDER_UNAVAILABLE",
  PAYMENT_FAILED: "PAYMENT_FAILED",
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TENANT_NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  INVALID_CREDENTIALS: 401,
  EMAIL_NOT_VERIFIED: 403,
  INVALID_TOKEN: 401,
  CUSTOMERS_NOT_ALLOWED: 403,
  USER_NOT_FOUND: 404,
  PROFESSIONAL_NOT_FOUND: 404,
  DOCUMENT_NOT_FOUND: 404,
  TENANT_SUSPENDED: 403,
  TENANT_ARCHIVED: 403,
  TENANT_NOT_READY: 400,
  PLAN_NOT_FOUND: 404,
  TEMPLATE_NOT_FOUND: 404,
  SUBCATEGORY_NOT_FOUND: 404,
  OPTION_NOT_FOUND: 404,
  CATEGORY_MISMATCH: 400,
  PREMIUM_TEMPLATE_FORBIDDEN: 403,
  CAPABILITY_NOT_ALLOWED: 403,
  PLAN_LIMIT_REACHED: 403,
  SITE_NOT_FOUND: 404,
  SITE_NOT_READY: 400,
  PAGE_NOT_FOUND: 404,
  SECTION_NOT_FOUND: 404,
  PRODUCT_NOT_FOUND: 404,
  PRODUCT_CATEGORY_NOT_FOUND: 404,
  VARIANT_NOT_FOUND: 404,
  PHOTO_NOT_FOUND: 404,
  RESERVATION_NOT_FOUND: 404,
  SLOT_UNAVAILABLE: 409,
  RESERVATIONS_DISABLED: 403,
  ORDER_NOT_FOUND: 404,
  ORDERS_DISABLED: 403,
  FULFILLMENT_UNAVAILABLE: 409,
  PRODUCT_UNAVAILABLE: 409,
  MIN_ORDER_NOT_MET: 409,
  SUBSCRIPTION_NOT_FOUND: 404,
  SUBSCRIPTION_EXPIRED: 403,
  PAYMENT_NOT_FOUND: 404,
  RECEIPT_NOT_FOUND: 404,
  PAYMENT_PROVIDER_UNAVAILABLE: 503,
  PAYMENT_FAILED: 402,
};

export const API_ERROR_MESSAGE: Record<ApiErrorCode, string> = {
  BAD_REQUEST: "Requête invalide",
  VALIDATION_ERROR: "Les données envoyées sont invalides",
  UNAUTHORIZED: "Authentification requise",
  FORBIDDEN: "Accès refusé",
  NOT_FOUND: "Ressource introuvable",
  TENANT_NOT_FOUND: "Espace professionnel introuvable",
  CONFLICT: "Cette ressource existe déjà",
  RATE_LIMITED: "Trop de requêtes, réessayez plus tard",
  INTERNAL_ERROR: "Une erreur inattendue est survenue",
  INVALID_CREDENTIALS: "Email ou mot de passe incorrect",
  EMAIL_NOT_VERIFIED: "Veuillez vérifier votre adresse e-mail",
  INVALID_TOKEN: "Lien ou code invalide ou expiré",
  CUSTOMERS_NOT_ALLOWED: "Cet espace n'accepte pas de comptes clients",
  USER_NOT_FOUND: "Utilisateur introuvable",
  PROFESSIONAL_NOT_FOUND: "Profil professionnel introuvable",
  DOCUMENT_NOT_FOUND: "Document introuvable",
  TENANT_SUSPENDED: "Cet espace professionnel est suspendu",
  TENANT_ARCHIVED: "Cet espace professionnel est archivé",
  TENANT_NOT_READY: "Des informations obligatoires manquent pour activer cet espace",
  PLAN_NOT_FOUND: "Offre commerciale introuvable",
  TEMPLATE_NOT_FOUND: "Modèle de site introuvable",
  SUBCATEGORY_NOT_FOUND: "Sous-catégorie introuvable",
  OPTION_NOT_FOUND: "Option d'offre introuvable",
  CATEGORY_MISMATCH: "Cette ressource n'est pas compatible avec la catégorie du site",
  PREMIUM_TEMPLATE_FORBIDDEN: "Ce modèle premium n'est pas inclus dans l'offre souscrite",
  CAPABILITY_NOT_ALLOWED: "Cette fonctionnalité n'est pas incluse dans l'offre souscrite",
  PLAN_LIMIT_REACHED: "La limite de votre offre est atteinte",
  SITE_NOT_FOUND: "Site professionnel introuvable",
  SITE_NOT_READY: "Le site n'est pas prêt à être publié",
  PAGE_NOT_FOUND: "Page introuvable",
  SECTION_NOT_FOUND: "Section introuvable",
  PRODUCT_NOT_FOUND: "Produit introuvable",
  PRODUCT_CATEGORY_NOT_FOUND: "Catégorie de produit introuvable",
  VARIANT_NOT_FOUND: "Variante introuvable",
  PHOTO_NOT_FOUND: "Photo introuvable",
  RESERVATION_NOT_FOUND: "Réservation introuvable",
  SLOT_UNAVAILABLE: "Ce créneau n'est plus disponible",
  RESERVATIONS_DISABLED: "Les réservations sont désactivées pour cet établissement",
  ORDER_NOT_FOUND: "Commande introuvable",
  ORDERS_DISABLED: "Les commandes sont désactivées pour cette boutique",
  FULFILLMENT_UNAVAILABLE: "Ce mode de livraison ou de retrait n'est pas proposé",
  PRODUCT_UNAVAILABLE: "Ce produit n'est pas disponible",
  MIN_ORDER_NOT_MET: "Le montant minimum de commande n'est pas atteint",
  SUBSCRIPTION_NOT_FOUND: "Abonnement introuvable",
  SUBSCRIPTION_EXPIRED: "L'abonnement est expiré : l'espace est en lecture seule",
  PAYMENT_NOT_FOUND: "Paiement introuvable",
  RECEIPT_NOT_FOUND: "Justificatif introuvable",
  PAYMENT_PROVIDER_UNAVAILABLE: "Le paiement en ligne n'est pas disponible pour le moment",
  PAYMENT_FAILED: "Le paiement n'a pas pu être confirmé",
};

export type ApiSuccess<T, M extends object = Record<string, unknown>> = {
  ok: true;
  data: T;
  meta?: M;
};

export type ApiErrorBody = {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
};

export type ApiFailure = {
  ok: false;
  error: ApiErrorBody;
};

export type ApiResponse<T, M extends object = Record<string, unknown>> = ApiSuccess<T, M> | ApiFailure;

export function isApiErrorCode(value: string): value is ApiErrorCode {
  return value in API_ERROR_STATUS;
}

export function errorCodeFromHttpStatus(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return API_ERROR_CODES.BAD_REQUEST;
    case 401:
      return API_ERROR_CODES.UNAUTHORIZED;
    case 403:
      return API_ERROR_CODES.FORBIDDEN;
    case 404:
      return API_ERROR_CODES.NOT_FOUND;
    case 409:
      return API_ERROR_CODES.CONFLICT;
    case 429:
      return API_ERROR_CODES.RATE_LIMITED;
    default:
      return status >= 500 ? API_ERROR_CODES.INTERNAL_ERROR : API_ERROR_CODES.BAD_REQUEST;
  }
}
