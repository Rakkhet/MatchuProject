CREATE TYPE "PaymentMethod" AS ENUM ('PROMPTPAY_QR', 'LEGACY_CHECKOUT');

CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED');

CREATE TYPE "ShippingStatus" AS ENUM ('PENDING', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

ALTER TYPE "OrderStatus" ADD VALUE 'CANCELLED';

ALTER TABLE "orders"
ADD COLUMN "payment_method" "PaymentMethod",
ADD COLUMN "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "shipping_status" "ShippingStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "payment_reference" TEXT,
ADD COLUMN "payment_qr_code_image" TEXT,
ADD COLUMN "payment_proof_image" TEXT,
ADD COLUMN "payment_proof_file_name" TEXT,
ADD COLUMN "payment_proof_mime_type" TEXT,
ADD COLUMN "paid_at" TIMESTAMP(3),
ADD COLUMN "shipped_at" TIMESTAMP(3),
ADD COLUMN "delivered_at" TIMESTAMP(3),
ADD COLUMN "cancelled_at" TIMESTAMP(3);

UPDATE "orders"
SET
  "payment_method" = 'LEGACY_CHECKOUT',
  "payment_status" = 'PAID',
  "shipping_status" = 'PENDING',
  "paid_at" = "created_at"
WHERE "payment_method" IS NULL;

CREATE INDEX "orders_payment_status_idx" ON "orders"("payment_status");

CREATE INDEX "orders_shipping_status_idx" ON "orders"("shipping_status");
