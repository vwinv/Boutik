-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('STOREFRONT', 'PRO');

-- CreateTable
CREATE TABLE "ReservationSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoConfirm" BOOLEAN NOT NULL DEFAULT true,
    "slotDurationMinutes" INTEGER NOT NULL DEFAULT 90,
    "slotIntervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "minPartySize" INTEGER NOT NULL DEFAULT 1,
    "maxPartySize" INTEGER NOT NULL DEFAULT 8,
    "maxCoversPerSlot" INTEGER NOT NULL DEFAULT 24,
    "maxReservationsPerSlot" INTEGER NOT NULL DEFAULT 12,
    "minAdvanceHours" INTEGER NOT NULL DEFAULT 2,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationHour" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "opensAt" TEXT,
    "closesAt" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT NOT NULL,
    "partySize" INTEGER NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT,
    "guestPhone" TEXT NOT NULL,
    "note" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "source" "ReservationSource" NOT NULL DEFAULT 'STOREFRONT',
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReservationSettings_tenantId_key" ON "ReservationSettings"("tenantId");
CREATE UNIQUE INDEX "ReservationHour_tenantId_weekday_key" ON "ReservationHour"("tenantId", "weekday");
CREATE INDEX "Reservation_tenantId_date_time_idx" ON "Reservation"("tenantId", "date", "time");
CREATE INDEX "Reservation_tenantId_status_idx" ON "Reservation"("tenantId", "status");

ALTER TABLE "ReservationSettings" ADD CONSTRAINT "ReservationSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReservationHour" ADD CONSTRAINT "ReservationHour_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
