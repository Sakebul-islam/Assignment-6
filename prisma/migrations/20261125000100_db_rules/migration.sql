-- Database rules that Prisma cannot express in the schema (PROJECT_PLAN.md §5.4).
-- IMPORTANT: Prisma does not know about the partial indexes below. When creating a new
-- migration, always use `prisma migrate dev --create-only`, review the SQL, and remove
-- any DROP INDEX for these indexes before applying it.

-- Seats are never negative and always add up to the capacity
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_seats_check" CHECK (
  "capacity" BETWEEN 1 AND 10
  AND "occupiedSeats" >= 0
  AND "reservedSeats" >= 0
  AND "availableSeats" >= 0
  AND "occupiedSeats" + "reservedSeats" + "availableSeats" = "capacity"
);

-- Money
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_money_check" CHECK ("monthlyRent" > 0 AND "deposit" >= 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_check" CHECK ("amount" > 0);

-- A move-in payment always points to an application
ALTER TABLE "payments" ADD CONSTRAINT "payments_target_check" CHECK ("purpose" <> 'MOVE_IN' OR "applicationId" IS NOT NULL);

-- One open application per tenant per room
CREATE UNIQUE INDEX "applications_one_open_per_room"
  ON "applications" ("tenantId", "roomId") WHERE "status" IN ('PENDING', 'APPROVED');

-- One live tenancy per tenant
CREATE UNIQUE INDEX "tenancies_one_live_per_tenant"
  ON "tenancies" ("tenantId") WHERE "status" IN ('ACTIVE', 'NOTICE_GIVEN');

-- At most one pending and one paid move-in payment per application
CREATE UNIQUE INDEX "payments_one_pending_per_application"
  ON "payments" ("applicationId") WHERE "status" = 'PENDING' AND "applicationId" IS NOT NULL;
CREATE UNIQUE INDEX "payments_one_paid_per_application"
  ON "payments" ("applicationId") WHERE "status" = 'PAID' AND "applicationId" IS NOT NULL;
