-- Ticket type, server-side SLA deadline and resolution note.
--
-- Backfill: every pre-existing ticket becomes an INCIDENT. INCIDENT is the
-- only type that accepts all four priorities, so no existing row can violate
-- the "SERVICE cannot be CRITICAL" rule enforced below.
--
-- sla_due_at stays NULL here on purpose: the working-time calendar (Polish
-- public holidays, Europe/Warsaw hours) lives in the application
-- (src/utils/working-time.ts) and is the single source of truth. The API
-- fills missing deadlines idempotently at startup from created_at, type and
-- priority (see backfillMissingSlaDueDates in src/services/sla.service.ts).
--
-- resolution_note stays NULL for tickets resolved/closed before this
-- migration; new resolutions require a non-empty note.

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('SERVICE', 'INCIDENT');

-- AlterTable + backfill. A constant default fills existing rows without a
-- table rewrite (PostgreSQL 11+); the default is dropped afterwards because
-- new tickets must always state their type explicitly.
ALTER TABLE "tickets"
  ADD COLUMN "type" "TicketType" NOT NULL DEFAULT 'INCIDENT',
  ADD COLUMN "sla_due_at" TIMESTAMPTZ(3),
  ADD COLUMN "resolution_note" TEXT;

ALTER TABLE "tickets" ALTER COLUMN "type" DROP DEFAULT;

-- Business-rule guards (defense in depth; the API validates first).
ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_service_not_critical_check"
    CHECK ("type" <> 'SERVICE' OR "priority" <> 'CRITICAL'),
  ADD CONSTRAINT "tickets_resolution_note_not_blank_check"
    CHECK ("resolution_note" IS NULL OR length(btrim("resolution_note")) > 0);

-- CreateIndex
CREATE INDEX "tickets_type_idx" ON "tickets"("type");

-- CreateIndex
CREATE INDEX "tickets_sla_due_at_idx" ON "tickets"("sla_due_at");
