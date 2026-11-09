import { createHash } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { getPaydunyaConfig } from "@boutik/config";
import { API_ERROR_CODES } from "@boutik/domain";
import { ApiException } from "../common/api-exception";

export type PaydunyaInvoiceInput = {
  totalAmount: number;
  description: string;
  storeName: string;
  storeTagline?: string | null;
  storePhone?: string | null;
  storeWebsite?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  items?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    description?: string;
  }>;
  customData?: Record<string, string | number | boolean | null | undefined>;
  returnUrl: string;
  cancelUrl: string;
  callbackUrl: string;
};

export type PaydunyaInvoiceResult = {
  token: string;
  invoiceUrl: string;
};

export type SoftPayMethod = "wave" | "orange" | "mtn";

export type SoftPayInput = {
  method: SoftPayMethod;
  invoiceToken: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  /** Requis pour Orange Money CI / BF SoftPay */
  otp?: string | null;
};

export type SoftPayResult = {
  success: boolean;
  message: string;
  /** URL Wave / QR Orange SN — à ouvrir côté client */
  paymentUrl: string | null;
  /** true = validation sur le téléphone (MTN push / USSD) */
  awaitCustomerConfirmation: boolean;
};

export type CashoutInput = {
  customerPhone: string;
  amountXof: number;
  /** Moyen utilisé à l’encaissement : wave | orange | mtn */
  paymentMethod?: string | null;
  callbackUrl: string;
};

export type CashoutResult = {
  success: boolean;
  message: string;
  disburseToken: string;
  withdrawMode: string;
};

type PaydunyaCreateResponse = {
  response_code?: string;
  response_text?: string;
  description?: string;
  token?: string;
};

type SoftPayApiResponse = {
  success?: boolean;
  message?: string;
  url?: string;
  other_url?: { om_url?: string; maxit_url?: string };
  fees?: number;
  currency?: string;
};

@Injectable()
export class PaydunyaService {
  private readonly logger = new Logger(PaydunyaService.name);

  isEnabled() {
    const config = getPaydunyaConfig();
    return Boolean(config.enabled && config.masterKey && config.privateKey && config.token);
  }

  assertEnabled() {
    if (!this.isEnabled()) {
      throw new ApiException(API_ERROR_CODES.PAYMENT_PROVIDER_UNAVAILABLE);
    }
  }

  async createCheckoutInvoice(input: PaydunyaInvoiceInput): Promise<PaydunyaInvoiceResult> {
    this.assertEnabled();
    const config = getPaydunyaConfig();

    const items: Record<string, unknown> = {};
    (input.items ?? []).forEach((item, index) => {
      items[`item_${index}`] = {
        name: item.name,
        quantity: item.quantity,
        unit_price: String(item.unitPrice),
        total_price: String(item.totalPrice),
        description: item.description ?? "",
      };
    });

    const customData: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.customData ?? {})) {
      if (value === null || value === undefined) continue;
      customData[key] = String(value);
    }

    const payload = {
      invoice: {
        total_amount: input.totalAmount,
        description: input.description,
        ...(Object.keys(items).length ? { items } : null),
        customer: {
          name: input.customerName || "",
          email: input.customerEmail || "",
          phone: input.customerPhone || "",
        },
      },
      store: {
        name: input.storeName,
        tagline: input.storeTagline || "",
        phone: input.storePhone || "",
        website_url: input.storeWebsite || "",
      },
      custom_data: customData,
      actions: {
        callback_url: input.callbackUrl,
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      },
    };

    const response = await fetch(`${config.baseUrl}/checkout-invoice/create`, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as PaydunyaCreateResponse | null;
    if (!response.ok || body?.response_code !== "00" || !body.token || !body.response_text) {
      this.logger.error(`PayDunya create invoice failed status=${response.status} body=${JSON.stringify(body)}`);
      throw new ApiException(
        API_ERROR_CODES.PAYMENT_FAILED,
        body?.response_text || body?.description || "Impossible de créer la facture PayDunya",
      );
    }

    return {
      token: body.token,
      invoiceUrl: body.response_text,
    };
  }

  /**
   * SoftPay : paiement sur le site marchand (pas la page checkout PayDunya).
   * 1) créer la facture → token
   * 2) appeler l’endpoint SoftPay du moyen choisi
   */
  async softPay(input: SoftPayInput): Promise<SoftPayResult> {
    this.assertEnabled();
    const config = getPaydunyaConfig();
    const phone = toLocalMsisdn(input.customerPhone, config.country);
    const email = input.customerEmail.trim() || `${phone}@pay.boutik.local`;
    const name = input.customerName.trim() || "Client";

    if (input.method === "orange" && config.country === "ci" && !input.otp?.trim()) {
      throw new ApiException(
        API_ERROR_CODES.VALIDATION_ERROR,
        "Saisissez le code OTP Orange Money (#144*82# → option 2)",
      );
    }

    const { path, body } = this.buildSoftPayRequest(input.method, {
      token: input.invoiceToken,
      name,
      email,
      phone,
      otp: input.otp?.trim() || "",
      country: config.country,
    });

    const response = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => null)) as SoftPayApiResponse | null;
    if (!response.ok || !payload?.success) {
      this.logger.error(`PayDunya SoftPay failed method=${input.method} status=${response.status} body=${JSON.stringify(payload)}`);
      throw new ApiException(
        API_ERROR_CODES.PAYMENT_FAILED,
        payload?.message || "Le paiement SoftPay a échoué",
      );
    }

    const paymentUrl =
      payload.url ||
      payload.other_url?.om_url ||
      payload.other_url?.maxit_url ||
      null;

    return {
      success: true,
      message: payload.message || "Paiement initié",
      paymentUrl,
      awaitCustomerConfirmation: !paymentUrl && input.method === "mtn",
    };
  }

  /**
   * Cashout / PUSH PayDunya : rembourse le client vers son wallet Mobile Money.
   * 1) get-invoice → disburse_token
   * 2) submit-invoice
   */
  async cashout(input: CashoutInput): Promise<CashoutResult> {
    this.assertEnabled();
    const config = getPaydunyaConfig();
    const phone = toLocalMsisdn(input.customerPhone, config.country);
    if (!phone || input.amountXof < 1) {
      throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "Téléphone ou montant invalide pour le remboursement");
    }

    const withdrawMode = resolveWithdrawMode(input.paymentMethod, config.country);
    const getResponse = await fetch(`${config.disburseBaseUrl}/disburse/get-invoice`, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify({
        account_alias: phone,
        amount: input.amountXof,
        withdraw_mode: withdrawMode,
        callback_url: input.callbackUrl,
      }),
    });

    const getBody = (await getResponse.json().catch(() => null)) as {
      response_code?: string;
      response_text?: string;
      description?: string;
      disburse_token?: string;
      token?: string;
    } | null;

    const disburseToken = getBody?.disburse_token || getBody?.token || "";
    if (!getResponse.ok || getBody?.response_code !== "00" || !disburseToken) {
      this.logger.error(`PayDunya cashout get-invoice failed status=${getResponse.status} body=${JSON.stringify(getBody)}`);
      throw new ApiException(
        API_ERROR_CODES.PAYMENT_FAILED,
        getBody?.response_text || getBody?.description || "Impossible de créer le cashout PayDunya",
      );
    }

    const submitResponse = await fetch(`${config.disburseBaseUrl}/disburse/submit-invoice`, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify({ disburse_invoice: disburseToken }),
    });

    const submitBody = (await submitResponse.json().catch(() => null)) as {
      response_code?: string;
      response_text?: string;
      description?: string;
      status?: string;
    } | null;

    if (!submitResponse.ok || (submitBody?.response_code && submitBody.response_code !== "00")) {
      this.logger.error(
        `PayDunya cashout submit-invoice failed status=${submitResponse.status} body=${JSON.stringify(submitBody)}`,
      );
      throw new ApiException(
        API_ERROR_CODES.PAYMENT_FAILED,
        submitBody?.response_text || submitBody?.description || "Le cashout PayDunya a échoué",
      );
    }

    return {
      success: true,
      message: submitBody?.response_text || submitBody?.description || "Remboursement initié",
      disburseToken,
      withdrawMode,
    };
  }

  verifyIpnHash(hash: string | undefined | null) {
    if (!hash) return false;
    const config = getPaydunyaConfig();
    if (!config.masterKey) return false;
    const expected = createHash("sha512").update(config.masterKey).digest("hex");
    return expected.toLowerCase() === hash.toLowerCase();
  }

  parseIpnPayload(body: unknown): {
    status: string;
    token: string | null;
    totalAmount: number | null;
    customData: Record<string, string>;
    raw: Record<string, unknown>;
  } | null {
    const root = asRecord(body);
    if (!root) return null;

    let data: Record<string, unknown> | null = null;
    if (typeof root.data === "string") {
      try {
        data = asRecord(JSON.parse(root.data));
      } catch {
        data = null;
      }
    } else {
      data = asRecord(root.data) ?? root;
    }
    if (!data) return null;

    const invoice = asRecord(data.invoice);
    const custom = asRecord(data.custom_data) ?? {};
    const customData: Record<string, string> = {};
    for (const [key, value] of Object.entries(custom)) {
      if (value === null || value === undefined) continue;
      customData[key] = String(value);
    }

    const status = String(data.status ?? "").toLowerCase();
    const token = typeof invoice?.token === "string" ? invoice.token : typeof data.token === "string" ? data.token : null;
    const totalRaw = invoice?.total_amount ?? data.total_amount;
    const totalAmount = totalRaw === undefined || totalRaw === null ? null : Number(totalRaw);

    return {
      status,
      token,
      totalAmount: Number.isFinite(totalAmount) ? totalAmount : null,
      customData,
      raw: data,
    };
  }

  private authHeaders() {
    const config = getPaydunyaConfig();
    return {
      "Content-Type": "application/json",
      "PAYDUNYA-MASTER-KEY": config.masterKey,
      "PAYDUNYA-PRIVATE-KEY": config.privateKey,
      "PAYDUNYA-TOKEN": config.token,
    };
  }

  private buildSoftPayRequest(
    method: SoftPayMethod,
    ctx: { token: string; name: string; email: string; phone: string; otp: string; country: "ci" | "sn" },
  ): { path: string; body: Record<string, string> } {
    if (ctx.country === "sn") {
      if (method === "wave") {
        return {
          path: "/softpay/wave-senegal",
          body: {
            wave_senegal_fullName: ctx.name,
            wave_senegal_email: ctx.email,
            wave_senegal_phone: ctx.phone,
            wave_senegal_payment_token: ctx.token,
          },
        };
      }
      if (method === "orange") {
        return {
          path: "/softpay/new-orange-money-senegal",
          body: {
            customer_name: ctx.name,
            customer_email: ctx.email,
            phone_number: ctx.phone,
            invoice_token: ctx.token,
          },
        };
      }
      throw new ApiException(
        API_ERROR_CODES.VALIDATION_ERROR,
        "MTN SoftPay n’est pas disponible pour le Sénégal — choisissez Wave ou Orange Money",
      );
    }

    // Côte d'Ivoire (défaut)
    if (method === "wave") {
      return {
        path: "/softpay/wave-ci",
        body: {
          wave_ci_fullName: ctx.name,
          wave_ci_email: ctx.email,
          wave_ci_phone: ctx.phone,
          wave_ci_payment_token: ctx.token,
        },
      };
    }
    if (method === "orange") {
      return {
        path: "/softpay/orange-money-ci",
        body: {
          orange_money_ci_customer_fullname: ctx.name,
          orange_money_ci_email: ctx.email,
          orange_money_ci_phone_number: ctx.phone,
          orange_money_ci_otp: ctx.otp,
          payment_token: ctx.token,
        },
      };
    }
    return {
      path: "/softpay/mtn-ci",
      body: {
        mtn_ci_customer_fullname: ctx.name,
        mtn_ci_email: ctx.email,
        mtn_ci_phone_number: ctx.phone,
        mtn_ci_wallet_provider: "MTNCI",
        payment_token: ctx.token,
      },
    };
  }
}

function toLocalMsisdn(raw: string, country: "ci" | "sn") {
  let digits = raw.replace(/\D/g, "");
  const prefix = country === "sn" ? "221" : "225";
  if (digits.startsWith(`00${prefix}`)) digits = digits.slice(2 + prefix.length);
  else if (digits.startsWith(prefix)) digits = digits.slice(prefix.length);
  return digits;
}

function resolveWithdrawMode(paymentMethod: string | null | undefined, country: "ci" | "sn") {
  const method = (paymentMethod || "").trim().toLowerCase();
  if (country === "sn") {
    if (method === "wave") return "wave-senegal";
    if (method === "orange") return "orange-money-senegal";
    throw new ApiException(
      API_ERROR_CODES.VALIDATION_ERROR,
      "Remboursement SoftPay Sénégal : Wave ou Orange Money uniquement",
    );
  }
  if (method === "wave") return "wave-ci";
  if (method === "orange") return "orange-money-ci";
  if (method === "mtn") return "mtn-ci";
  throw new ApiException(
    API_ERROR_CODES.VALIDATION_ERROR,
    "Indiquez le moyen de paiement (Wave, Orange Money ou MTN) pour rembourser",
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
