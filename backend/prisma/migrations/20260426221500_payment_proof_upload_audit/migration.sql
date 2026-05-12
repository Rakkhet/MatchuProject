CREATE TABLE "payment_proof_uploads" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "uploaded_by_user_id" INTEGER,
    "payment_reference" TEXT,
    "image_data" TEXT NOT NULL,
    "original_file_name" TEXT,
    "mime_type" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_proof_uploads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_proof_uploads_order_id_uploaded_at_idx" ON "payment_proof_uploads"("order_id", "uploaded_at");

CREATE INDEX "payment_proof_uploads_uploaded_by_user_id_uploaded_at_idx" ON "payment_proof_uploads"("uploaded_by_user_id", "uploaded_at");

ALTER TABLE "payment_proof_uploads" ADD CONSTRAINT "payment_proof_uploads_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_proof_uploads" ADD CONSTRAINT "payment_proof_uploads_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
WHERE "payment_proof_image" IS NOT NULL;
