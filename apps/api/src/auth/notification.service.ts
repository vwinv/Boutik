import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { getPublicOrigin } from "@boutik/config";
import { SmsService } from "../sms/sms.service";
import { MailerService } from "./mailer.service";

@Injectable()
export class NotificationService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly mailer: MailerService,
    private readonly sms: SmsService,
  ) {
    this.logger.setContext(NotificationService.name);
  }

  async sendEmailVerification(email: string, token: string) {
    const url = `${getPublicOrigin()}/app/verify-email?token=${token}`;
    await this.mailer.send({
      to: email,
      subject: "Vérifiez votre adresse e-mail — Boutik",
      text: `Bonjour,\n\nConfirmez votre adresse e-mail en ouvrant ce lien :\n${url}\n\nS'il ne vient pas de vous, ignorez ce message.\n`,
      html: emailLayout(
        "Vérifiez votre e-mail",
        `<p>Bonjour,</p><p>Confirmez votre adresse e-mail pour activer votre compte Boutik.</p><p><a href="${url}" style="display:inline-block;padding:12px 18px;background:#c45c26;color:#fff;text-decoration:none;border-radius:8px">Vérifier mon e-mail</a></p><p style="color:#666;font-size:13px">Ou copiez ce lien :<br>${url}</p>`,
      ),
    });
  }

  async sendPasswordReset(email: string, token: string) {
    const url = `${getPublicOrigin()}/app/reset-password?token=${token}`;
    await this.mailer.send({
      to: email,
      subject: "Réinitialisation du mot de passe — Boutik",
      text: `Bonjour,\n\nRéinitialisez votre mot de passe via ce lien :\n${url}\n\nS'il ne vient pas de vous, ignorez ce message.\n`,
      html: emailLayout(
        "Réinitialiser le mot de passe",
        `<p>Bonjour,</p><p>Une demande de réinitialisation de mot de passe a été faite pour votre compte.</p><p><a href="${url}" style="display:inline-block;padding:12px 18px;background:#c45c26;color:#fff;text-decoration:none;border-radius:8px">Choisir un nouveau mot de passe</a></p><p style="color:#666;font-size:13px">Ou copiez ce lien :<br>${url}</p>`,
      ),
    });
  }

  async sendPhoneVerification(phone: string, code: string) {
    const result = await this.sms.send(
      phone,
      `Boutik : votre code de verification est ${code}. Valable 15 minutes.`,
    );
    if (!result.ok) {
      this.logger.warn({ phone, code, error: result.error }, "Échec SMS code téléphone");
    } else if (result.skipped) {
      this.logger.warn({ phone, code }, "Code téléphone (eSMS désactivé — log seulement)");
    }
  }

  async sendVerificationCodeEmail(email: string, code: string) {
    const cells = code
      .split("")
      .map(
        (digit) =>
          `<td style="width:46px;height:54px;text-align:center;vertical-align:middle;font-size:28px;font-weight:700;font-family:Helvetica,Arial,sans-serif;border:1px solid #e5e5e5;border-radius:12px">${escapeHtml(digit)}</td>`,
      )
      .join("");
    await this.mailer.send({
      to: email,
      subject: `${code} est votre code Boutik`,
      text: `${code}\n\nSaisissez ce code à 6 chiffres pour confirmer votre téléphone. Il est valable 15 minutes.\n`,
      html: emailLayout(
        "Votre code de vérification",
        `<p>Saisissez ce code à 6 chiffres pour confirmer votre téléphone :</p><table role="presentation" cellpadding="6" cellspacing="0"><tr>${cells}</tr></table><p style="font-size:22px;font-weight:700;font-family:Helvetica,Arial,sans-serif">${escapeHtml(code)}</p><p style="color:#666;font-size:13px">Valable 15 minutes. Un nouvel envoi par e-mail reprend ce même code.</p>`,
      ),
    });
  }

  async sendPhoneCodeByEmail(email: string, code: string) {
    await this.sendVerificationCodeEmail(email, code);
  }

  async sendOrderCreated(input: {
    to: string;
    shop: string;
    customerName: string;
    number: string;
    totalXof: number;
    currency: string;
    fulfillment: string;
  }) {
    const mode = input.fulfillment === "PICKUP" ? "retrait en boutique" : "livraison";
    const amount = `${input.totalXof} ${input.currency}`;
    await this.mailer.send({
      to: input.to,
      subject: `Commande ${input.number} — ${input.shop}`,
      text: `Bonjour ${input.customerName},\n\nVotre commande ${input.number} chez ${input.shop} est enregistrée (${mode}).\nMontant : ${amount}.\n`,
      html: emailLayout(
        `Commande ${input.number}`,
        `<p>Bonjour ${escapeHtml(input.customerName)},</p><p>Votre commande chez <strong>${escapeHtml(input.shop)}</strong> est enregistrée en ${mode}.</p><p>Montant : <strong>${escapeHtml(amount)}</strong>.</p>`,
      ),
    });
  }

  async sendOrderStatus(input: {
    to: string;
    shop: string;
    customerName: string;
    number: string;
    status: string;
  }) {
    const label = ORDER_STATUS_LABEL[input.status] ?? input.status;
    await this.mailer.send({
      to: input.to,
      subject: `Commande ${input.number} : ${label} — ${input.shop}`,
      text: `Bonjour ${input.customerName},\n\nVotre commande ${input.number} chez ${input.shop} est maintenant : ${label}.\n`,
      html: emailLayout(
        `Commande ${input.number}`,
        `<p>Bonjour ${escapeHtml(input.customerName)},</p><p>Votre commande chez <strong>${escapeHtml(input.shop)}</strong> est maintenant : <strong>${escapeHtml(label)}</strong>.</p>`,
      ),
    });
  }

  async sendOrderSms(input: {
    phone: string;
    number: string;
    status: string;
    shop?: string;
  }) {
    const label = ORDER_STATUS_LABEL[input.status] ?? input.status;
    const shop = input.shop?.trim() || "Boutik";
    const text = `${shop}: commande ${input.number} - ${label}.`;
    return this.sms.send(input.phone, text);
  }
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "en attente",
  CONFIRMED: "confirmée",
  PREPARING: "en préparation",
  READY: "prête",
  OUT_FOR_DELIVERY: "en cours de livraison",
  DELIVERED: "livrée",
  PICKED_UP: "retirée",
  CANCELLED: "annulée",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function emailLayout(title: string, body: string) {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f4efe6;font-family:Helvetica,Arial,sans-serif;color:#1c1915">
    <div style="max-width:560px;margin:32px auto;background:#fff;padding:32px;border-radius:16px">
      <p style="letter-spacing:.2em;text-transform:uppercase;color:#3d5a45;font-size:12px">Boutik</p>
      <h1 style="font-size:24px;font-weight:500">${title}</h1>
      ${body}
    </div>
  </body>
</html>`;
}
