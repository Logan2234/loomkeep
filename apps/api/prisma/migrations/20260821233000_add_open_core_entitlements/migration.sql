-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('STRIPE', 'SELF_HOST_LICENSE', 'FRIENDS_FAMILY', 'BETA_TESTER', 'COMPENSATION', 'ADMIN_GRANT');

-- CreateEnum
CREATE TYPE "SubscriptionProvider" AS ENUM ('STRIPE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'UNPAID');

-- AlterTable
-- Dropped, not backfilled into UserEntitlement: `entitlements` was never read
-- by any code (see docs/adr/0001-open-core-agpl.md), so every row was still
-- at its default `[]` — there is nothing meaningful to carry over.
ALTER TABLE "User" DROP COLUMN "entitlements";

-- CreateTable
CREATE TABLE "UserEntitlement" (
    "userId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "source" "EntitlementSource",
    "grantedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "overrides" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserEntitlement_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "SubscriptionProvider" NOT NULL,
    "providerSubscriptionId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
-- Hand-added (not expressible in schema.prisma): guarantees at most one
-- ACTIVE subscription per user at the database level, as a last-resort
-- guard against a webhook retry/race creating two simultaneously-active
-- rows. See docs/adr/0001-open-core-agpl.md.
CREATE UNIQUE INDEX "one_active_subscription_per_user" ON "Subscription"("userId") WHERE "status" = 'ACTIVE';

-- AddForeignKey
ALTER TABLE "UserEntitlement" ADD CONSTRAINT "UserEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
