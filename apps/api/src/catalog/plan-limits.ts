import { API_ERROR_CODES } from "@boutik/domain";
import { ApiException } from "../common/api-exception";

type PlanLimitsSource = {
  category: string;
  plan: {
    maxCatalogItems: number | null;
    maxCollaborators: number;
    maxAppointments: number | null;
    commissionPct: number | null;
    name: string;
  } | null;
};

export function planLimits(source: PlanLimitsSource) {
  const plan = source.plan;
  return {
    planName: plan?.name ?? null,
    maxCatalogItems: plan?.maxCatalogItems ?? null,
    maxCollaborators: plan?.maxCollaborators ?? null,
    maxAppointments: plan?.maxAppointments ?? null,
    commissionPct: plan?.commissionPct ?? null,
  };
}

/** Bloque si le nombre d’éléments catalogue (produits / plats) atteint le plafond de l’offre. */
export function assertCatalogItemQuota(source: PlanLimitsSource, currentCount: number) {
  const max = source.plan?.maxCatalogItems;
  if (max == null) return;
  if (currentCount >= max) {
    const label = source.category === "RESTAURANT" ? "plats" : "produits";
    throw new ApiException(
      API_ERROR_CODES.PLAN_LIMIT_REACHED,
      `Votre offre autorise au maximum ${max} ${label}. Passez à une offre supérieure pour en ajouter.`,
      { limit: "maxCatalogItems", max, current: currentCount },
    );
  }
}

export function assertCollaboratorQuota(source: PlanLimitsSource, currentCount: number) {
  const max = source.plan?.maxCollaborators;
  if (max == null) return;
  if (currentCount >= max) {
    throw new ApiException(
      API_ERROR_CODES.PLAN_LIMIT_REACHED,
      `Votre offre autorise au maximum ${max} collaborateur${max > 1 ? "s" : ""}.`,
      { limit: "maxCollaborators", max, current: currentCount },
    );
  }
}
