CREATE TABLE "order_payments" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "submitted_by_user_id" INTEGER,
    "payment_reference" TEXT,
    "qr_image_data" TEXT,
    "proof_image_data" TEXT,
    "proof_file_name" TEXT,
    "proof_mime_type" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_payments_order_id_key" ON "order_payments"("order_id");
CREATE INDEX "order_payments_submitted_by_user_id_submitted_at_idx" ON "order_payments"("submitted_by_user_id", "submitted_at");
CREATE INDEX "order_payments_payment_reference_idx" ON "order_payments"("payment_reference");

ALTER TABLE "order_payments"
ADD CONSTRAINT "order_payments_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_payments"
ADD CONSTRAINT "order_payments_submitted_by_user_id_fkey"
FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

WITH latest_qr AS (
    SELECT DISTINCT ON ("order_id")
        "order_id",
        "generated_by_user_id",
        "payment_reference",
        "image_data",
        "created_at"
    FROM "payment_qr_snapshots"
    ORDER BY "order_id", "created_at" DESC, "id" DESC
),
latest_proof AS (
    SELECT DISTINCT ON ("order_id")
        "order_id",
        "uploaded_by_user_id",
        "payment_reference",
        "image_data",
        "original_file_name",
        "mime_type",
        "uploaded_at",
        "created_at"
    FROM "payment_proof_uploads"
    ORDER BY "order_id", "uploaded_at" DESC, "id" DESC
)
INSERT INTO "order_payments" (
    "order_id",
    "submitted_by_user_id",
    "payment_reference",
    "qr_image_data",
    "proof_image_data",
    "proof_file_name",
    "proof_mime_type",
    "submitted_at",
    "created_at",
    "updated_at"
)
SELECT
    COALESCE(q."order_id", p."order_id") AS "order_id",
    COALESCE(q."generated_by_user_id", p."uploaded_by_user_id") AS "submitted_by_user_id",
    COALESCE(p."payment_reference", q."payment_reference") AS "payment_reference",
    q."image_data" AS "qr_image_data",
    p."image_data" AS "proof_image_data",
    p."original_file_name" AS "proof_file_name",
    p."mime_type" AS "proof_mime_type",
    COALESCE(p."uploaded_at", q."created_at", CURRENT_TIMESTAMP) AS "submitted_at",
    COALESCE(p."created_at", q."created_at", CURRENT_TIMESTAMP) AS "created_at",
    COALESCE(p."uploaded_at", q."created_at", CURRENT_TIMESTAMP) AS "updated_at"
FROM latest_qr q
FULL OUTER JOIN latest_proof p
    ON p."order_id" = q."order_id";

DROP TABLE "payment_qr_snapshots";
DROP TABLE "payment_proof_uploads";
