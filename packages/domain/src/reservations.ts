import { WEEKDAYS } from "./types";

export function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function timeFromMinutes(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function isoWeekdayFromDate(date: Date) {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

export function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function defaultReservationHours() {
  return WEEKDAYS.map((weekday) => ({
    weekday,
    isClosed: weekday === 1,
    opensAt: weekday === 1 ? null : "19:00",
    closesAt: weekday === 1 ? null : "22:30",
  }));
}

export function generateSlotTimes(opensAt: string, closesAt: string, intervalMinutes: number, durationMinutes: number) {
  const start = minutesFromTime(opensAt);
  const end = minutesFromTime(closesAt);
  const lastStart = end - durationMinutes;
  const slots: string[] = [];
  if (lastStart < start) {
    return slots;
  }
  for (let cursor = start; cursor <= lastStart; cursor += intervalMinutes) {
    slots.push(timeFromMinutes(cursor));
  }
  return slots;
}
