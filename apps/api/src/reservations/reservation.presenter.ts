import type { Reservation, ReservationHour, ReservationSettings } from "@prisma/client";
import { formatIsoDate } from "@boutik/domain";

export function presentSettings(settings: ReservationSettings) {
  return {
    isEnabled: settings.isEnabled,
    autoConfirm: settings.autoConfirm,
    slotDurationMinutes: settings.slotDurationMinutes,
    slotIntervalMinutes: settings.slotIntervalMinutes,
    minPartySize: settings.minPartySize,
    maxPartySize: settings.maxPartySize,
    maxCoversPerSlot: settings.maxCoversPerSlot,
    maxReservationsPerSlot: settings.maxReservationsPerSlot,
    minAdvanceHours: settings.minAdvanceHours,
    maxAdvanceDays: settings.maxAdvanceDays,
  };
}

export function presentHours(hours: ReservationHour[]) {
  return hours.map((item) => ({
    weekday: item.weekday,
    opensAt: item.opensAt,
    closesAt: item.closesAt,
    isClosed: item.isClosed,
  }));
}

export function presentReservation(item: Reservation) {
  return {
    id: item.id,
    date: formatIsoDate(item.date),
    time: item.time,
    partySize: item.partySize,
    guestName: item.guestName,
    guestEmail: item.guestEmail,
    guestPhone: item.guestPhone,
    note: item.note,
    status: item.status,
    source: item.source,
    cancelledAt: item.cancelledAt,
    cancelReason: item.cancelReason,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
