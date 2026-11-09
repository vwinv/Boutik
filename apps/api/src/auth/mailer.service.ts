import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import nodemailer, { type Transporter } from "nodemailer";
import { getSmtpConfig, isSmtpEnabled } from "@boutik/config";

@Injectable()
export class MailerService implements OnModuleInit, OnModuleDestroy {
  private transporter: Transporter | null = null;

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(MailerService.name);
  }

  async onModuleInit() {
    if (!isSmtpEnabled()) {
      this.logger.warn("SMTP désactivé");
      return;
    }

    try {
      await this.getTransporter().verify();
      this.logger.info({ host: getSmtpConfig().host }, "SMTP prêt");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn({ err: message }, "SMTP indisponible — démarrage sans e-mail");
    }
  }

  onModuleDestroy() {
    this.transporter?.close();
  }

  async send(options: { to: string; subject: string; text: string; html: string }) {
    if (!isSmtpEnabled()) {
      this.logger.warn({ to: options.to, subject: options.subject }, "SMTP désactivé, e-mail non envoyé");
      return;
    }

    const smtp = getSmtpConfig();
    const transporter = this.getTransporter();
    await transporter.sendMail({
      from: smtp.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    this.logger.info({ to: options.to, subject: options.subject }, "E-mail envoyé");
  }

  private getTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    const smtp = getSmtpConfig();
    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.password,
      },
    });
    return this.transporter;
  }
}
