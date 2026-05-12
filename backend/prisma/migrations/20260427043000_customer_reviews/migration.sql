CREATE TABLE "customer_reviews" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "order_id" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "review_text" TEXT NOT NULL,
    "author_name_snapshot" TEXT NOT NULL,
    "location_label" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_reviews_order_id_key" ON "customer_reviews"("order_id");
CREATE INDEX "customer_reviews_is_published_created_at_idx" ON "customer_reviews"("is_published", "created_at");
CREATE INDEX "customer_reviews_user_id_created_at_idx" ON "customer_reviews"("user_id", "created_at");

ALTER TABLE "customer_reviews"
ADD CONSTRAINT "customer_reviews_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_reviews"
ADD CONSTRAINT "customer_reviews_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
