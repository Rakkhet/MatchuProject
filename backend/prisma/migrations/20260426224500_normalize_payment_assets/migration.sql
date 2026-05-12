CREATE TABLE "payment_qr_snapshots" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "generated_by_user_id" INTEGER,
    "payment_reference" TEXT,
    "image_data" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_qr_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_qr_snapshots_order_id_created_at_idx" ON "payment_qr_snapshots"("order_id", "created_at");

CREATE INDEX "payment_qr_snapshots_generated_by_user_id_created_at_idx" ON "payment_qr_snapshots"("generated_by_user_id", "created_at");

ALTER TABLE "payment_qr_snapshots" ADD CONSTRAINT "payment_qr_snapshots_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_qr_snapshots" ADD CONSTRAINT "payment_qr_snapshots_generated_by_user_id_fkey" FOREIGN KEY ("generated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "payment_proof_uploads" (
    "order_id",
    "uploaded_by_user_id",
    "payment_reference",
    "image_data",
    "original_file_name",
    "mime_type",
    "uploaded_at",
    "created_at"
)
SELECT
    "id",
    "user_id",
    "payment_reference",
    "payment_proof_image",
    "payment_proof_file_name",
    "payment_proof_mime_type",
    COALESCE("paid_at", "updated_at", "created_at"),
    COALESCE("paid_at", "created_at")
FROM "orders"
WHERE "payment_proof_image" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "payment_proof_uploads" p
    WHERE p."order_id" = "orders"."id"
  );

INSERT INTO "payment_qr_snapshots" (
    "order_id",
    "generated_by_user_id",
    "payment_reference",
    "image_data",
    "created_at"
)
SELECT
    "id",
    "user_id",
    "payment_reference",
    "payment_qr_code_image",
    COALESCE("paid_at", "created_at")
FROM "orders"
WHERE "payment_qr_code_image" IS NOT NULL;

ALTER TABLE "orders"
DROP COLUMN "payment_qr_code_image",
DROP COLUMN "payment_proof_image",
DROP COLUMN "payment_proof_file_name",
DROP COLUMN "payment_proof_mime_type";
