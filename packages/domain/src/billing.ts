import type { BillingInterval, SubscriptionAccess } from "./types";

const DAY_MS = 86_400_000;

/** Commission plateforme Boutik prélevée sur chaque vente professionnelle. */
export const BOUTIK_COMMISSION_RATE = 0.05;

export function boutikCommissionXof(saleTotalXof: number) {
  const total = Math.max(0, Math.round(saleTotalXof));
  return Math.round(total * BOUTIK_COMMISSION_RATE);
}

/** Montant net crédité au wallet pro après commission Boutik. */
export function proNetSaleXof(saleTotalXof: number) {
  const total = Math.max(0, Math.round(saleTotalXof));
  return Math.max(0, total - boutikCommissionXof(total));
}

export function addBillingInterval(start: Date, interval: BillingInterval) {
  const next = new Date(start.getTime());
  if (interval === "YEARLY") {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

export function subscriptionAccess(endsAt: Date, graceDays: number, now = new Date()): SubscriptionAccess {
  if (now.getTime() <= endsAt.getTime()) {
    return "ACTIVE";
  }
  const graceEnd = endsAt.getTime() + Math.max(0, graceDays) * DAY_MS;
  if (now.getTime() <= graceEnd) {
    return "GRACE";
  }
  return "EXPIRED";
}
