import { Injectable } from "@nestjs/common";
import type {
  Prisma,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@prisma/client";
import { API_ERROR_CODES } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { ProNotificationsService } from "../notifications/pro-notifications.service";
import { PrismaService } from "../prisma/prisma.service";

const FAQ = [
  {
    id: "publish",
    category: "PERSONNALISATION" as const,
    question: "Comment publier mon site ?",
    answer:
      "Depuis « Mon site », cliquez sur Publier. Votre site est en ligne immédiatement à son adresse boutik.app.",
  },
  {
    id: "withdraw",
    category: "RETRAIT" as const,
    question: "Quand puis-je retirer mon argent ?",
    answer:
      "Les ventes encaissées sont immédiatement disponibles sur votre wallet. Vous pouvez demander un retrait dès 1 000 FCFA.",
  },
  {
    id: "payments",
    category: "PAIEMENT" as const,
    question: "Quels moyens de paiement acceptent mes clients ?",
    answer:
      "Wave, Orange Money, MTN MoMo et carte bancaire. Le paiement à la livraison peut être activé dans Paramètres.",
  },
  {
    id: "template",
    category: "PERSONNALISATION" as const,
    question: "Puis-je changer de modèle sans perdre mon contenu ?",
    answer: "Oui. Vos produits, textes et images sont conservés, seule la présentation change.",
  },
  {
    id: "cancel-order",
    category: "COMMANDE" as const,
    question: "Comment annuler une commande ?",
    answer:
      "Ouvrez la commande puis cliquez sur « Annuler la commande ». Si elle était payée, vous pourrez la rembourser.",
  },
  {
    id: "plan",
    category: "ABONNEMENT" as const,
    question: "Comment changer d’offre ?",
    answer:
      "Dans Abonnement, choisissez la nouvelle offre. Le changement s’applique à la prochaine échéance.",
  },
] as const;

const CATEGORY_LABEL: Record<SupportTicketCategory, string> = {
  TECHNIQUE: "Technique",
  PAIEMENT: "Paiement",
  COMMANDE: "Commande",
  RETRAIT: "Retrait",
  ABONNEMENT: "Abonnement",
  PERSONNALISATION: "Personnalisation",
};

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  OPEN: "Ouvert",
  IN_PROGRESS: "En cours",
  RESOLVED: "Résolu",
  CLOSED: "Fermé",
};

const PRIORITY_LABEL: Record<SupportTicketPriority, string> = {
  HIGH: "Haute",
  MEDIUM: "Moyenne",
  LOW: "Basse",
};

const STATUS_STEPS: SupportTicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: ProNotificationsService,
  ) {}

  faq() {
    return FAQ.map((item) => ({
      id: item.id,
      category: item.category,
      categoryLabel: CATEGORY_LABEL[item.category],
      question: item.question,
      answer: item.answer,
    }));
  }

  async listTickets(tenantId: string) {
    const tickets = await this.prisma.supportTicket.findMany({
      where: { tenantId },
      include: {
        messages: { orderBy: { createdAt: "asc" }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return tickets.map((ticket) => this.presentSummary(ticket, ticket.messages.length));
  }

  async listAllTickets() {
    const days7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [tickets, staffMembers] = await Promise.all([
      this.prisma.supportTicket.findMany({
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          assignedTo: { select: { id: true, name: true } },
          messages: {
            orderBy: { createdAt: "asc" },
            select: { id: true, authorType: true, createdAt: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      this.listStaffAssignees(),
    ]);

    const items = tickets.map((ticket) => {
      const firstPro = ticket.messages.find((message) => message.authorType === "PRO");
      const firstSupport = ticket.messages.find((message) => message.authorType === "SUPPORT");
      const awaitingStaff =
        !firstSupport ||
        (ticket.status !== "CLOSED" &&
          ticket.status !== "RESOLVED" &&
          ticket.messages[ticket.messages.length - 1]?.authorType === "PRO");
      return {
        ...this.presentSummary(ticket, ticket.messages.length),
        tenantId: ticket.tenant.id,
        tenantName: ticket.tenant.name,
        tenantSlug: ticket.tenant.slug,
        priority: ticket.priority,
        priorityLabel: PRIORITY_LABEL[ticket.priority],
        assignedToUserId: ticket.assignedToUserId,
        assignedToName: ticket.assignedTo?.name ?? null,
        awaitingStaff,
        firstResponseMinutes:
          firstPro && firstSupport
            ? Math.max(
                0,
                Math.round((firstSupport.createdAt.getTime() - firstPro.createdAt.getTime()) / 60_000),
              )
            : null,
      };
    });

    const openCount = items.filter((item) => item.status === "OPEN").length;
    const inProgressCount = items.filter((item) => item.status === "IN_PROGRESS").length;
    const awaitingCount = items.filter(
      (item) => item.awaitingStaff && item.status !== "CLOSED" && item.status !== "RESOLVED",
    ).length;
    const responseSamples = items
      .filter(
        (item) =>
          item.firstResponseMinutes != null && new Date(item.createdAt) >= days7,
      )
      .map((item) => item.firstResponseMinutes as number);
    const avgFirstResponseMinutes =
      responseSamples.length > 0
        ? Math.round(responseSamples.reduce((sum, value) => sum + value, 0) / responseSamples.length)
        : null;

    return {
      kpis: {
        openCount,
        inProgressCount,
        awaitingCount,
        avgFirstResponseMinutes,
      },
      staffMembers,
      items,
    };
  }

  async getTicketById(ticketId: string) {
    const ticket = await this.requireTicketById(ticketId);
    const detail = this.presentDetail(ticket);
    const staffMembers = await this.listStaffAssignees();
    return {
      ...detail,
      tenantId: ticket.tenant.id,
      tenantName: ticket.tenant.name,
      tenantSlug: ticket.tenant.slug,
      priority: ticket.priority,
      priorityLabel: PRIORITY_LABEL[ticket.priority],
      assignedToUserId: ticket.assignedToUserId,
      assignedToName: ticket.assignedTo?.name ?? null,
      staffMembers,
      messages: detail.messages.map((message) => ({
        ...message,
        authorLabel:
          message.authorType === "PRO" ? ticket.tenant.name : "Support Boutik",
      })),
    };
  }

  async staffReply(ticketId: string, staffUserId: string, body: string) {
    const text = body.trim();
    if (text.length < 1) {
      throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "Message vide");
    }
    const existing = await this.requireTicketById(ticketId);
    if (existing.status === "CLOSED") {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Ce ticket est fermé");
    }

    await this.prisma.supportMessage.create({
      data: {
        ticketId: existing.id,
        authorType: "SUPPORT",
        authorUserId: staffUserId,
        body: text,
      },
    });

    await this.prisma.supportTicket.update({
      where: { id: existing.id },
      data: {
        status: existing.status === "OPEN" ? "IN_PROGRESS" : existing.status,
        closedAt: null,
      },
    });

    await this.notifications.notify({
      tenantId: existing.tenantId,
      kind: "SUPPORT",
      title: `Réponse support · ${existing.number}`,
      body: existing.subject,
      href: "/support",
      dedupeKey: `support:staff-reply:${existing.id}:${Date.now()}`,
    });

    return this.getTicketById(ticketId);
  }

  async staffSetStatus(ticketId: string, status: SupportTicketStatus) {
    return this.staffUpdate(ticketId, { status });
  }

  async staffUpdate(
    ticketId: string,
    input: {
      status?: SupportTicketStatus;
      priority?: SupportTicketPriority;
      assignedToUserId?: string | null;
    },
  ) {
    const existing = await this.requireTicketById(ticketId);
    if (input.assignedToUserId) {
      const staff = await this.prisma.user.findFirst({
        where: { id: input.assignedToUserId, staffRole: { not: "NONE" }, staffStatus: "ACTIVE" },
        select: { id: true },
      });
      if (!staff) {
        throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "Assigné invalide");
      }
    }

    const nextStatus = input.status ?? existing.status;
    await this.prisma.supportTicket.update({
      where: { id: existing.id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.priority ? { priority: input.priority } : {}),
        ...(input.assignedToUserId !== undefined ? { assignedToUserId: input.assignedToUserId } : {}),
        closedAt:
          nextStatus === "CLOSED" || nextStatus === "RESOLVED"
            ? existing.closedAt ?? new Date()
            : null,
      },
    });
    return this.getTicketById(ticketId);
  }

  async getTicket(tenantId: string, ticketId: string) {
    const ticket = await this.requireTicket(tenantId, ticketId);
    return this.presentDetail(ticket);
  }

  async createTicket(
    tenantId: string,
    userId: string,
    input: { subject: string; category: SupportTicketCategory; message: string },
  ) {
    const subject = input.subject.trim();
    const message = input.message.trim();
    if (subject.length < 3) {
      throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "Indiquez un sujet");
    }
    if (message.length < 5) {
      throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "Décrivez votre demande");
    }

    const ticket = await this.prisma.$transaction(async (tx) => {
      const number = await this.nextNumber(tx);
      const created = await tx.supportTicket.create({
        data: {
          tenantId,
          number,
          subject,
          category: input.category,
          status: "OPEN",
          priority: inferPriority(subject),
          createdByUserId: userId,
          messages: {
            create: {
              authorType: "PRO",
              authorUserId: userId,
              body: message,
            },
          },
        },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
        },
      });
      return created;
    });

    return this.presentDetail(ticket);
  }

  async reply(tenantId: string, userId: string, ticketId: string, body: string) {
    const text = body.trim();
    if (text.length < 1) {
      throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "Message vide");
    }
    const existing = await this.requireTicket(tenantId, ticketId);
    if (existing.status === "CLOSED") {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Ce ticket est fermé");
    }

    await this.prisma.supportMessage.create({
      data: {
        ticketId: existing.id,
        authorType: "PRO",
        authorUserId: userId,
        body: text,
      },
    });

    if (existing.status === "RESOLVED") {
      await this.prisma.supportTicket.update({
        where: { id: existing.id },
        data: { status: "IN_PROGRESS" },
      });
    } else if (existing.status === "OPEN") {
      await this.prisma.supportTicket.update({
        where: { id: existing.id },
        data: { status: "IN_PROGRESS" },
      });
    }

    return this.getTicket(tenantId, ticketId);
  }

  async closeTicket(tenantId: string, ticketId: string) {
    const existing = await this.requireTicket(tenantId, ticketId);
    if (existing.status === "CLOSED") {
      return this.presentDetail(existing);
    }
    const updated = await this.prisma.supportTicket.update({
      where: { id: existing.id },
      data: { status: "CLOSED", closedAt: new Date() },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    return this.presentDetail(updated);
  }

  private async requireTicket(tenantId: string, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, tenantId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!ticket) {
      throw new ApiException(API_ERROR_CODES.NOT_FOUND, "Ticket introuvable");
    }
    return ticket;
  }

  private async requireTicketById(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        assignedTo: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!ticket) {
      throw new ApiException(API_ERROR_CODES.NOT_FOUND, "Ticket introuvable");
    }
    return ticket;
  }

  private async listStaffAssignees() {
    const staff = await this.prisma.user.findMany({
      where: { staffRole: { not: "NONE" }, staffStatus: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return staff.map((user) => ({ id: user.id, name: user.name }));
  }

  private async nextNumber(tx: Prisma.TransactionClient) {
    const last = await tx.supportTicket.findFirst({
      orderBy: { createdAt: "desc" },
      select: { number: true },
    });
    const current = last ? Number.parseInt(last.number.replace(/\D/g, ""), 10) : 200;
    const next = Number.isFinite(current) ? current + 1 : 201;
    return `T-${next}`;
  }

  private presentSummary(
    ticket: {
      id: string;
      number: string;
      subject: string;
      category: SupportTicketCategory;
      status: SupportTicketStatus;
      priority?: SupportTicketPriority;
      createdAt: Date;
      updatedAt: Date;
    },
    messageCount: number,
  ) {
    const priority = ticket.priority ?? "MEDIUM";
    return {
      id: ticket.id,
      number: ticket.number,
      subject: ticket.subject,
      category: ticket.category,
      categoryLabel: CATEGORY_LABEL[ticket.category],
      status: ticket.status,
      statusLabel: STATUS_LABEL[ticket.status],
      priority,
      priorityLabel: PRIORITY_LABEL[priority],
      messageCount,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }

  private presentDetail(ticket: {
    id: string;
    number: string;
    subject: string;
    category: SupportTicketCategory;
    status: SupportTicketStatus;
    createdAt: Date;
    updatedAt: Date;
    closedAt: Date | null;
    messages: Array<{
      id: string;
      authorType: "PRO" | "SUPPORT";
      body: string;
      createdAt: Date;
    }>;
  }) {
    const statusIndex = STATUS_STEPS.indexOf(ticket.status);
    return {
      ...this.presentSummary(ticket, ticket.messages.length),
      closedAt: ticket.closedAt?.toISOString() ?? null,
      statusSteps: STATUS_STEPS.map((step, index) => ({
        key: step,
        label: STATUS_LABEL[step],
        done: index <= statusIndex,
        current: index === statusIndex,
      })),
      messages: ticket.messages.map((message) => ({
        id: message.id,
        authorType: message.authorType,
        authorLabel: message.authorType === "PRO" ? "Vous" : "Support Boutik",
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }
}

function inferPriority(subject: string): SupportTicketPriority {
  if (/bloqué|urgent|refus|panne|critique|erreur/i.test(subject)) return "HIGH";
  if (/paiement|retrait|abonnement|commande/i.test(subject)) return "MEDIUM";
  return "LOW";
}
