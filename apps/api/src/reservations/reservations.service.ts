import { Injectable } from "@nestjs/common";
import type { ReservationHour, ReservationSettings, ReservationStatus } from "@prisma/client";
import {
  ACTIVE_RESERVATION_STATUSES,
  API_ERROR_CODES,
  defaultReservationHours,
  formatIsoDate,
  generateSlotTimes,
  isoWeekdayFromDate,
  minutesFromTime,
  parseIsoDate,
  sitePublicStatus,
  tenantSlugFromHost,
} from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { assertOfferingCapability } from "../catalog/effective-capabilities";
import { PrismaService } from "../prisma/prisma.service";
import { TenantAccessService } from "../professionals/tenant-access.service";
import { workspaceWithRelations, type WorkspaceRecord } from "../professionals/workspace.presenter";
import type {
  CancelReservationDto,
  CreateReservationDto,
  ListReservationsQueryDto,
  ReservationHourDayDto,
  ReservationStatusDto,
  UpdateReservationDto,
  UpdateReservationHoursDto,
  UpdateReservationSettingsDto,
} from "./dto/reservation.dto";
import { presentHours, presentReservation, presentSettings } from "./reservation.presenter";

const STATUS_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  PENDING: ["CONFIRMED", "SEATED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["SEATED", "CANCELLED", "NO_SHOW", "PENDING"],
  SEATED: ["COMPLETED", "NO_SHOW", "CONFIRMED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

type PublicQuery = { slug?: string; host?: string; date?: string };

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
  ) {}

  async getSettings(userId: string, tenantId: string) {
    const tenant = await this.requireReservations(userId, tenantId);
    return presentSettings(await this.ensureSettings(tenant.id));
  }

  async updateSettings(userId: string, tenantId: string, input: UpdateReservationSettingsDto) {
    const tenant = await this.requireReservations(userId, tenantId, { mutate: true });
    const current = await this.ensureSettings(tenant.id);
    const nextMin = input.minPartySize ?? current.minPartySize;
    const nextMax = input.maxPartySize ?? current.maxPartySize;
    if (nextMin > nextMax) {
      throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "Le nombre minimum de convives dépasse le maximum");
    }
    return presentSettings(
      await this.prisma.reservationSettings.update({
        where: { tenantId: tenant.id },
        data: input,
      }),
    );
  }

  async getHours(userId: string, tenantId: string) {
    const tenant = await this.requireReservations(userId, tenantId);
    return presentHours(await this.ensureHours(tenant.id));
  }

  async updateHours(userId: string, tenantId: string, input: UpdateReservationHoursDto) {
    const tenant = await this.requireReservations(userId, tenantId, { mutate: true });
    await this.ensureHours(tenant.id);
    for (const day of input.days) {
      this.assertHourDay(day);
      await this.prisma.reservationHour.upsert({
        where: { tenantId_weekday: { tenantId: tenant.id, weekday: day.weekday } },
        update: {
          isClosed: day.isClosed ?? false,
          opensAt: day.isClosed ? null : (day.opensAt ?? null),
          closesAt: day.isClosed ? null : (day.closesAt ?? null),
        },
        create: {
          tenantId: tenant.id,
          weekday: day.weekday,
          isClosed: day.isClosed ?? false,
          opensAt: day.isClosed ? null : (day.opensAt ?? null),
          closesAt: day.isClosed ? null : (day.closesAt ?? null),
        },
      });
    }
    return presentHours(await this.ensureHours(tenant.id));
  }

  async list(userId: string, tenantId: string, query: ListReservationsQueryDto) {
    const tenant = await this.requireReservations(userId, tenantId);
    const from = query.from ? this.requireDate(query.from) : undefined;
    const to = query.to ? this.requireDate(query.to) : undefined;
    const items = await this.prisma.reservation.findMany({
      where: {
        tenantId: tenant.id,
        status: query.status,
        date: from || to ? { gte: from, lte: to } : undefined,
      },
      orderBy: [{ date: "asc" }, { time: "asc" }, { createdAt: "asc" }],
    });
    return items.map(presentReservation);
  }

  async get(userId: string, tenantId: string, reservationId: string) {
    const tenant = await this.requireReservations(userId, tenantId);
    return presentReservation(await this.requireReservation(tenant.id, reservationId));
  }

  async create(userId: string, tenantId: string, input: CreateReservationDto) {
    const tenant = await this.requireReservations(userId, tenantId, { mutate: true });
    const settings = await this.ensureSettings(tenant.id);
    const hours = await this.ensureHours(tenant.id);
    return presentReservation(await this.book(tenant.id, settings, hours, input, "PRO"));
  }

  async update(userId: string, tenantId: string, reservationId: string, input: UpdateReservationDto) {
    const tenant = await this.requireReservations(userId, tenantId, { mutate: true });
    const current = await this.requireReservation(tenant.id, reservationId);
    if (current.status === "CANCELLED" || current.status === "COMPLETED" || current.status === "NO_SHOW") {
      throw new ApiException(API_ERROR_CODES.CONFLICT, "Cette réservation ne peut plus être modifiée");
    }
    const nextDate = input.date ?? formatIsoDate(current.date);
    const nextTime = input.time ?? current.time;
    const nextParty = input.partySize ?? current.partySize;
    const settings = await this.ensureSettings(tenant.id);
    const hours = await this.ensureHours(tenant.id);
    this.assertBookable(settings, hours, {
      date: nextDate,
      time: nextTime,
      partySize: nextParty,
    });
    await this.assertCapacity(tenant.id, this.requireDate(nextDate), nextTime, nextParty, settings, current.id);
    return presentReservation(
      await this.prisma.reservation.update({
        where: { id: current.id },
        data: {
          date: this.requireDate(nextDate),
          time: nextTime,
          partySize: nextParty,
          guestName: input.guestName,
          guestPhone: input.guestPhone,
          guestEmail: input.guestEmail,
          note: input.note,
        },
      }),
    );
  }

  async cancel(userId: string, tenantId: string, reservationId: string, input: CancelReservationDto) {
    return this.setStatus(userId, tenantId, reservationId, { status: "CANCELLED" }, input.reason);
  }

  async confirm(userId: string, tenantId: string, reservationId: string) {
    return this.setStatus(userId, tenantId, reservationId, { status: "CONFIRMED" });
  }

  async setStatus(userId: string, tenantId: string, reservationId: string, input: ReservationStatusDto, reason?: string) {
    const tenant = await this.requireReservations(userId, tenantId, { mutate: true });
    const current = await this.requireReservation(tenant.id, reservationId);
    if (current.status === input.status) {
      return presentReservation(current);
    }
    if (!STATUS_TRANSITIONS[current.status].includes(input.status)) {
      throw new ApiException(API_ERROR_CODES.CONFLICT, "Ce changement de statut n'est pas autorisé", {
        from: current.status,
        to: input.status,
      });
    }
    return presentReservation(
      await this.prisma.reservation.update({
        where: { id: current.id },
        data: {
          status: input.status,
          cancelledAt: input.status === "CANCELLED" ? new Date() : current.cancelledAt,
          cancelReason: input.status === "CANCELLED" ? (reason ?? current.cancelReason) : current.cancelReason,
        },
      }),
    );
  }

  async publicSlots(query: PublicQuery) {
    const tenant = await this.requirePublicRestaurant(query);
    const dateValue = query.date;
    if (!dateValue) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Indiquez une date au format AAAA-MM-JJ");
    }
    const date = this.requireDate(dateValue);
    const settings = await this.ensureSettings(tenant.id);
    if (!settings.isEnabled) {
      throw new ApiException(API_ERROR_CODES.RESERVATIONS_DISABLED);
    }
    const hours = await this.ensureHours(tenant.id);
    const weekday = isoWeekdayFromDate(date);
    const day = hours.find((item) => item.weekday === weekday);
    const times =
      !day || day.isClosed || !day.opensAt || !day.closesAt
        ? []
        : generateSlotTimes(day.opensAt, day.closesAt, settings.slotIntervalMinutes, settings.slotDurationMinutes);
    const occupancy = await this.occupancyByTime(tenant.id, date);
    const now = new Date();
    return {
      date: dateValue,
      timezone: tenant.timezone,
      minPartySize: settings.minPartySize,
      maxPartySize: settings.maxPartySize,
      slotDurationMinutes: settings.slotDurationMinutes,
      slots: times.map((time) => {
        const used = occupancy.get(time) ?? { covers: 0, count: 0 };
        const remainingCovers = Math.max(0, settings.maxCoversPerSlot - used.covers);
        const remainingReservations = Math.max(0, settings.maxReservationsPerSlot - used.count);
        const available =
          remainingCovers >= settings.minPartySize && remainingReservations > 0 && this.isWithinAdvance(now, date, time, settings);
        return { time, remainingCovers, remainingReservations, available };
      }),
    };
  }

  async publicCreate(query: PublicQuery, input: CreateReservationDto) {
    const tenant = await this.requirePublicRestaurant(query);
    const settings = await this.ensureSettings(tenant.id);
    if (!settings.isEnabled) {
      throw new ApiException(API_ERROR_CODES.RESERVATIONS_DISABLED);
    }
    const hours = await this.ensureHours(tenant.id);
    return presentReservation(await this.book(tenant.id, settings, hours, input, "STOREFRONT"));
  }

  private async book(
    tenantId: string,
    settings: ReservationSettings,
    hours: ReservationHour[],
    input: CreateReservationDto,
    source: "PRO" | "STOREFRONT",
  ) {
    this.assertBookable(settings, hours, input);
    const date = this.requireDate(input.date);
    await this.assertCapacity(tenantId, date, input.time, input.partySize, settings);
    return this.prisma.reservation.create({
      data: {
        tenantId,
        date,
        time: input.time,
        partySize: input.partySize,
        guestName: input.guestName,
        guestEmail: input.guestEmail ?? null,
        guestPhone: input.guestPhone,
        note: input.note ?? null,
        source,
        status: settings.autoConfirm ? "CONFIRMED" : "PENDING",
      },
    });
  }

  private assertBookable(
    settings: ReservationSettings,
    hours: ReservationHour[],
    input: { date: string; time: string; partySize: number },
  ) {
    if (input.partySize < settings.minPartySize || input.partySize > settings.maxPartySize) {
      throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "Le nombre de convives n'est pas accepté", {
        minPartySize: settings.minPartySize,
        maxPartySize: settings.maxPartySize,
      });
    }
    const date = this.requireDate(input.date);
    const weekday = isoWeekdayFromDate(date);
    const day = hours.find((item) => item.weekday === weekday);
    const times =
      !day || day.isClosed || !day.opensAt || !day.closesAt
        ? []
        : generateSlotTimes(day.opensAt, day.closesAt, settings.slotIntervalMinutes, settings.slotDurationMinutes);
    if (!times.includes(input.time)) {
      throw new ApiException(API_ERROR_CODES.SLOT_UNAVAILABLE, "Ce créneau n'est pas proposé");
    }
    if (!this.isWithinAdvance(new Date(), date, input.time, settings)) {
      throw new ApiException(API_ERROR_CODES.SLOT_UNAVAILABLE, "Ce créneau est hors délai de réservation");
    }
  }

  private async assertCapacity(
    tenantId: string,
    date: Date,
    time: string,
    partySize: number,
    settings: ReservationSettings,
    excludeId?: string,
  ) {
    const occupancy = await this.occupancyByTime(tenantId, date, excludeId);
    const used = occupancy.get(time) ?? { covers: 0, count: 0 };
    if (used.count + 1 > settings.maxReservationsPerSlot || used.covers + partySize > settings.maxCoversPerSlot) {
      throw new ApiException(API_ERROR_CODES.SLOT_UNAVAILABLE);
    }
  }

  private async occupancyByTime(tenantId: string, date: Date, excludeId?: string) {
    const rows = await this.prisma.reservation.findMany({
      where: {
        tenantId,
        date,
        status: { in: [...ACTIVE_RESERVATION_STATUSES] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { time: true, partySize: true },
    });
    const map = new Map<string, { covers: number; count: number }>();
    for (const row of rows) {
      const current = map.get(row.time) ?? { covers: 0, count: 0 };
      current.covers += row.partySize;
      current.count += 1;
      map.set(row.time, current);
    }
    return map;
  }

  private isWithinAdvance(now: Date, date: Date, time: string, settings: ReservationSettings) {
    const slotAt = new Date(date.getTime() + minutesFromTime(time) * 60_000);
    const minAt = new Date(now.getTime() + settings.minAdvanceHours * 3_600_000);
    const maxDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + settings.maxAdvanceDays));
    return slotAt.getTime() >= minAt.getTime() && date.getTime() <= maxDate.getTime();
  }

  private assertHourDay(day: ReservationHourDayDto) {
    if (day.isClosed) {
      return;
    }
    if (!day.opensAt || !day.closesAt) {
      throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "Indiquez les horaires d'ouverture et de fermeture");
    }
    if (minutesFromTime(day.opensAt) >= minutesFromTime(day.closesAt)) {
      throw new ApiException(API_ERROR_CODES.VALIDATION_ERROR, "L'heure de fermeture doit être après l'ouverture");
    }
  }

  private requireDate(value: string) {
    const date = parseIsoDate(value);
    if (!date) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "La date doit être au format AAAA-MM-JJ");
    }
    return date;
  }

  private async ensureSettings(tenantId: string) {
    const existing = await this.prisma.reservationSettings.findUnique({ where: { tenantId } });
    if (existing) {
      return existing;
    }
    return this.prisma.reservationSettings.create({ data: { tenantId } });
  }

  private async ensureHours(tenantId: string) {
    const existing = await this.prisma.reservationHour.findMany({
      where: { tenantId },
      orderBy: { weekday: "asc" },
    });
    if (existing.length === 7) {
      return existing;
    }
    const present = new Set(existing.map((item) => item.weekday));
    await this.prisma.reservationHour.createMany({
      data: defaultReservationHours()
        .filter((day) => !present.has(day.weekday))
        .map((day) => ({ tenantId, ...day })),
    });
    return this.prisma.reservationHour.findMany({
      where: { tenantId },
      orderBy: { weekday: "asc" },
    });
  }

  private async requireReservation(tenantId: string, reservationId: string) {
    const item = await this.prisma.reservation.findFirst({ where: { id: reservationId, tenantId } });
    if (!item) {
      throw new ApiException(API_ERROR_CODES.RESERVATION_NOT_FOUND);
    }
    return item;
  }

  private async requireReservations(userId: string, tenantId: string, options?: { mutate?: boolean }) {
    const tenant = await this.access.getWorkspaceForMember(userId, tenantId, options);
    assertOfferingCapability(tenant, "reservations");
    return tenant;
  }

  private async requirePublicRestaurant(input: { slug?: string; host?: string }) {
    const slug = input.slug?.trim().toLowerCase() || tenantSlugFromHost(input.host);
    if (!slug) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Indiquez un slug ou un sous-domaine");
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      include: { ...workspaceWithRelations, site: true },
    });
    if (!tenant?.site) {
      throw new ApiException(API_ERROR_CODES.SITE_NOT_FOUND, undefined, { slug });
    }
    const status = sitePublicStatus(tenant.status, tenant.site.status);
    if (status === "ARCHIVED") {
      throw new ApiException(API_ERROR_CODES.TENANT_NOT_FOUND, undefined, { slug });
    }
    if (status === "SUSPENDED") {
      throw new ApiException(API_ERROR_CODES.TENANT_SUSPENDED, undefined, { slug });
    }
    if (status !== "PUBLISHED") {
      throw new ApiException(API_ERROR_CODES.SITE_NOT_FOUND, undefined, { slug });
    }
    assertOfferingCapability(tenant, "reservations");
    return tenant;
  }
}
