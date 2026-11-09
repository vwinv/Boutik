import type {
  PaymentReceipt,
  Plan,
  Subscription,
  SubscriptionEvent,
  SubscriptionPayment,
  SubscriptionPeriod,
} from "@prisma/client";
import { subscriptionAccess } from "@boutik/domain";

export const subscriptionInclude = {
  plan: { select: { id: true, slug: true, name: true, category: true } },
  periods: { orderBy: { sequence: "asc" as const } },
  payments: { include: { receipts: { orderBy: { createdAt: "asc" as const } } }, orderBy: { createdAt: "asc" as const } },
  events: { orderBy: { createdAt: "asc" as const } },
} as const;

export type SubscriptionRecord = Subscription & {
  plan: Pick<Plan, "id" | "slug" | "name" | "category">;
  periods: SubscriptionPeriod[];
  payments: Array<SubscriptionPayment & { receipts: PaymentReceipt[] }>;
  events: SubscriptionEvent[];
};

export function presentReceipt(receipt: PaymentReceipt, url: string) {
  return {
    id: receipt.id,
    originalName: receipt.originalName,
    mimeType: receipt.mimeType,
    sizeBytes: receipt.sizeBytes,
    url,
    createdAt: receipt.createdAt,
  };
}

export function presentPayment(
  payment: SubscriptionPayment & { receipts: PaymentReceipt[] },
  receiptUrl: (receipt: PaymentReceipt) => string,
) {
  return {
    id: payment.id,
    periodId: payment.periodId,
    amountXof: payment.amountXof,
    currency: payment.currency,
    status: payment.status,
    method: payment.method,
    reference: payment.reference,
    failureReason: payment.failureReason,
    paidAt: payment.paidAt,
    receipts: payment.receipts.map((receipt) => presentReceipt(receipt, receiptUrl(receipt))),
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

export function presentPeriod(period: SubscriptionPeriod) {
  return {
    id: period.id,
    sequence: period.sequence,
    startedAt: period.startedAt,
    endsAt: period.endsAt,
  };
}

export function presentEvent(event: SubscriptionEvent) {
  return {
    id: event.id,
    type: event.type,
    message: event.message,
    createdAt: event.createdAt,
  };
}

export function presentSubscription(subscription: SubscriptionRecord, receiptUrl: (paymentId: string, receiptId: string) => string) {
  return {
    id: subscription.id,
    status: subscription.status,
    interval: subscription.interval,
    graceDays: subscription.graceDays,
    expiredRestriction: subscription.expiredRestriction,
    startedAt: subscription.startedAt,
    currentPeriodEndsAt: subscription.currentPeriodEndsAt,
    access:
      subscription.status === "ACTIVE"
        ? subscriptionAccess(subscription.currentPeriodEndsAt, subscription.graceDays)
        : "EXPIRED",
    plan: subscription.plan,
    periods: subscription.periods.map(presentPeriod),
    payments: subscription.payments.map((payment) =>
      presentPayment(payment, (receipt) => receiptUrl(payment.id, receipt.id)),
    ),
    events: subscription.events.map(presentEvent),
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}
