ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'UPLOADED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';

CREATE TYPE "OrderHistoryEventType" AS ENUM (
    'CHECKOUT_SUBMITTED',
    'PAYMENT_STATUS_CHANGED',
    'SHIPPING_STATUS_CHANGED',
    'ORDER_CANCELLED',
    'TRACKING_UPDATED',
    'INVENTORY_ADJUSTED'
);

ALTER TABLE "products"
ADD COLUMN "track_inventory" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "stock_quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN "allow_backorder" BOOLEAN NOT NULL DEFAULT false;

UPDATE "products"
SET "stock_quantity" = CASE
    WHEN "sold_out" = true THEN 0
    ELSE 20
END;

ALTER TABLE "orders"
ADD COLUMN "customer_phone" TEXT,
ADD COLUMN "shipping_address_line_1" TEXT,
ADD COLUMN "shipping_address_line_2" TEXT,
ADD COLUMN "shipping_district" TEXT,
ADD COLUMN "shipping_province" TEXT,
ADD COLUMN "shipping_postal_code" TEXT,
ADD COLUMN "shipping_country" TEXT,
ADD COLUMN "shipping_carrier" TEXT,
ADD COLUMN "tracking_number" TEXT,
ADD COLUMN "subtotal_amount" INTEGER,
ADD COLUMN "shipping_amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "discount_amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "total_amount" INTEGER,
ADD COLUMN "total_currency" "CurrencyCode";

CREATE INDEX "orders_tracking_number_idx" ON "orders"("tracking_number");

UPDATE "orders"
SET
    "total_currency" = CASE
        WHEN POSITION('+' IN "total_summary") = 0 AND "total_summary" LIKE '$%' THEN 'USD'::"CurrencyCode"
        WHEN POSITION('+' IN "total_summary") = 0 AND "total_summary" LIKE '%B%' THEN 'THB'::"CurrencyCode"
        ELSE NULL
    END,
    "subtotal_amount" = CASE
        WHEN POSITION('+' IN "total_summary") = 0
          AND NULLIF(REGEXP_REPLACE("total_summary", '[^0-9.]', '', 'g'), '') IS NOT NULL
        THEN ROUND(CAST(NULLIF(REGEXP_REPLACE("total_summary", '[^0-9.]', '', 'g'), '') AS NUMERIC))::INTEGER
        ELSE NULL
    END,
    "total_amount" = CASE
        WHEN POSITION('+' IN "total_summary") = 0
          AND NULLIF(REGEXP_REPLACE("total_summary", '[^0-9.]', '', 'g'), '') IS NOT NULL
        THEN ROUND(CAST(NULLIF(REGEXP_REPLACE("total_summary", '[^0-9.]', '', 'g'), '') AS NUMERIC))::INTEGER
        ELSE NULL
    END;

CREATE TABLE "order_status_history" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "changed_by_user_id" INTEGER,
    "event_type" "OrderHistoryEventType" NOT NULL,
    "from_order_status" "OrderStatus",
    "to_order_status" "OrderStatus",
    "from_payment_status" "PaymentStatus",
    "to_payment_status" "PaymentStatus",
    "from_shipping_status" "ShippingStatus",
    "to_shipping_status" "ShippingStatus",
    "shipping_carrier" TEXT,
    "tracking_number" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_status_history_order_id_created_at_idx"
ON "order_status_history"("order_id", "created_at");

CREATE INDEX "order_status_history_changed_by_user_id_created_at_idx"
ON "order_status_history"("changed_by_user_id", "created_at");

ALTER TABLE "order_status_history"
ADD CONSTRAINT "order_status_history_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_status_history"
ADD CONSTRAINT "order_status_history_changed_by_user_id_fkey"
FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "order_status_history" (
    "order_id",
    "changed_by_user_id",
    "event_type",
    "to_order_status",
    "to_payment_status",
    "to_shipping_status",
    "shipping_carrier",
    "tracking_number",
    "note",
    "created_at"
)
SELECT
    "id",
    "user_id",
    'CHECKOUT_SUBMITTED'::"OrderHistoryEventType",
    "status",
    "payment_status",
    "shipping_status",
    "shipping_carrier",
    "tracking_number",
    'Initial snapshot imported from existing order record.',
    "created_at"
FROM "orders";
