export type CheckoutDraft = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  fulfillment: "DELIVERY" | "PICKUP";
  addressLine: string;
  city: string;
  note: string;
  paymentMethod: "wave" | "orange" | "mtn" | "card" | "cod";
  /** OTP Orange Money SoftPay (#144*82#) */
  paymentOtp: string;
};

export const emptyCheckout: CheckoutDraft = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  fulfillment: "DELIVERY",
  addressLine: "",
  city: "",
  note: "",
  paymentMethod: "wave",
  paymentOtp: "",
};

export const CHECKOUT_STEPS = ["Coordonnées", "Livraison", "Paiement", "Confirmation"] as const;

export function checkoutStorageKey(slug: string) {
  return `boutik.checkout.${slug}`;
}

export function paymentLabel(method: CheckoutDraft["paymentMethod"]) {
  switch (method) {
    case "wave":
      return "Wave";
    case "orange":
      return "Orange Money";
    case "mtn":
      return "MTN MoMo";
    case "card":
      return "Carte bancaire";
    case "cod":
      return "Paiement à la livraison";
  }
}

export function productSlugFromCartKey(key: string) {
  return key.includes(":") ? key.slice(0, key.indexOf(":")) : key;
}

export function variantNameFromCartKey(key: string) {
  return key.includes(":") ? key.slice(key.indexOf(":") + 1) : null;
}

/** Soften local numbers into E.164 for the orders API (default CI +225). */
export function toE164Phone(raw: string, defaultCountry = "225") {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith(defaultCountry)) return `+${digits}`;
  return `+${defaultCountry}${digits.replace(/^0+/, "")}`;
}
