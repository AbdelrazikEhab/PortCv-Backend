/*
  Warnings:

  - You are about to drop the column `plan_id` on the `subscriptions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "plan_id",
ADD COLUMN     "ai_credits_limit" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "ai_credits_used" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "current_period_start" TIMESTAMP(3),
ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'free',
ADD COLUMN     "portfolios_limit" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "portfolios_used" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "resumes_limit" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "resumes_used" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stripe_customer_id" TEXT,
ADD COLUMN     "stripe_subscription_id" TEXT,
ADD COLUMN     "trial_days_granted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trial_ends_at" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'active';

-- CreateTable
CREATE TABLE "pricing_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "monthly_price" DOUBLE PRECISION NOT NULL,
    "yearly_price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "features" JSONB NOT NULL DEFAULT '{}',
    "ai_credits_per_month" INTEGER NOT NULL,
    "portfolios_limit" INTEGER NOT NULL,
    "resumes_limit" INTEGER NOT NULL,
    "stripe_monthly_price_id" TEXT,
    "stripe_yearly_price_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "gateway" TEXT NOT NULL DEFAULT 'stripe',
    "gateway_transaction_id" TEXT,
    "gateway_invoice_id" TEXT,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'subscription',
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_settings" (
    "id" TEXT NOT NULL,
    "ats_score_price" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "resume_parse_price" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "default_trial_days" INTEGER NOT NULL DEFAULT 7,
    "active_offers" JSONB DEFAULT '[]',
    "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gifted_access" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "granted_by" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "days_granted" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gifted_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pricing_plans_name_key" ON "pricing_plans"("name");

-- CreateIndex
CREATE INDEX "transactions_user_id_idx" ON "transactions"("user_id");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_gateway_idx" ON "transactions"("gateway");

-- CreateIndex
CREATE INDEX "gifted_access_user_id_idx" ON "gifted_access"("user_id");

-- CreateIndex
CREATE INDEX "gifted_access_expires_at_idx" ON "gifted_access"("expires_at");

-- CreateIndex
CREATE INDEX "gifted_access_is_active_idx" ON "gifted_access"("is_active");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_plan_idx" ON "subscriptions"("plan");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gifted_access" ADD CONSTRAINT "gifted_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
