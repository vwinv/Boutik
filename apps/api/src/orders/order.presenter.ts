import type { Order, OrderEvent, OrderItem, OrderSettings } from "@prisma/client";

export const orderInclude = {
  items: { orderBy: { createdAt: "asc" as const } },
  events: { orderBy: { createdAt: "asc" as const } },
} as const;

export type OrderRecord = Order & {
  items: OrderItem[];
  events: OrderEvent[];
};

export function presentSettings(settings: OrderSettings) {
  return {
    isEnabled: settings.isEnabled,
    pickupEnabled: settings.pickupEnabled,
    deliveryEnabled: settings.deliveryEnabled,
    deliveryFeeXof: settings.deliveryFeeXof,
    freeDeliveryFromXof: settings.freeDeliveryFromXof,
    minOrderXof: settings.minOrderXof,
    notifyEmail: settings.notifyEmail,
    notifySms: settings.notifySms,
  };
}

export function presentPublicSettings(
  settings: OrderSettings,
  currency: string,
  options?: { onlinePaymentEnabled?: boolean },
) {
  return {
    isEnabled: settings.isEnabled,
    pickupEnabled: settings.pickupEnabled,
    deliveryEnabled: settings.deliveryEnabled,
    deliveryFeeXof: settings.deliveryFeeXof,
    freeDeliveryFromXof: settings.freeDeliveryFromXof,
    minOrderXof: settings.minOrderXof,
    currency,
    onlinePaymentEnabled: options?.onlinePaymentEnabled ?? false,
  };
}

export function presentOrderItem(item: OrderItem) {
  return {
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    productName: item.productName,
    variantName: item.variantName,
    unitPriceXof: item.unitPriceXof,
    quantity: item.quantity,
    lineTotalXof: item.lineTotalXof,
  };
}

export function presentOrderEvent(event: OrderEvent) {
  return {
    id: event.id,
    type: event.type,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    channel: event.channel,
    message: event.message,
    createdAt: event.createdAt,
  };
}

export function presentOrder(order: OrderRecord) {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    fulfillment: order.fulfillment,
    customerUserId: order.customerUserId,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    addressLine: order.addressLine,
    city: order.city,
    region: order.region,
    postalCode: order.postalCode,
    note: order.note,
    subtotalXof: order.subtotalXof,
    deliveryFeeXof: order.deliveryFeeXof,
    totalXof: order.totalXof,
    currency: order.currency,
    paymentStatus: order.paymentStatus,
    paymentProvider: order.paymentProvider,
    paymentMethod: order.paymentMethod,
    paydunyaToken: order.paydunyaToken,
    paydunyaInvoiceUrl: order.paydunyaInvoiceUrl,
    paidAt: order.paidAt,
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
    items: order.items.map(presentOrderItem),
    events: order.events.map(presentOrderEvent),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function presentQuote(input: {
  currency: string;
  fulfillment: string;
  items: Array<{
    productId: string;
    variantId: string | null;
    productName: string;
    variantName: string | null;
    unitPriceXof: number;
    quantity: number;
    lineTotalXof: number;
  }>;
  subtotalXof: number;
  deliveryFeeXof: number;
  totalXof: number;
}) {
  return input;
}
