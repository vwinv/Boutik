import type { FulfillmentMethod, OrderStatus } from "./types";

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY", "PICKED_UP", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  PICKED_UP: [],
  CANCELLED: [],
};

export function formatOrderNumber(sequence: number) {
  return `CMD-${String(sequence).padStart(4, "0")}`;
}

export function deliveryFeeFor(input: {
  fulfillment: FulfillmentMethod;
  subtotalXof: number;
  deliveryFeeXof: number;
  freeDeliveryFromXof: number | null;
}) {
  if (input.fulfillment === "PICKUP") {
    return 0;
  }
  if (input.freeDeliveryFromXof != null && input.subtotalXof >= input.freeDeliveryFromXof) {
    return 0;
  }
  return input.deliveryFeeXof;
}

export function orderTotals(input: {
  lines: Array<{ unitPriceXof: number; quantity: number }>;
  fulfillment: FulfillmentMethod;
  deliveryFeeXof: number;
  freeDeliveryFromXof: number | null;
}) {
  const subtotalXof = input.lines.reduce((sum, line) => sum + line.unitPriceXof * line.quantity, 0);
  const deliveryFeeXof = deliveryFeeFor({
    fulfillment: input.fulfillment,
    subtotalXof,
    deliveryFeeXof: input.deliveryFeeXof,
    freeDeliveryFromXof: input.freeDeliveryFromXof,
  });
  return {
    subtotalXof,
    deliveryFeeXof,
    totalXof: subtotalXof + deliveryFeeXof,
  };
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus, fulfillment: FulfillmentMethod) {
  if (!ORDER_STATUS_TRANSITIONS[from].includes(to)) {
    return false;
  }
  if (to === "OUT_FOR_DELIVERY" || to === "DELIVERED") {
    return fulfillment === "DELIVERY";
  }
  if (to === "PICKED_UP") {
    return fulfillment === "PICKUP";
  }
  return true;
}
