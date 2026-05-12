CREATE TYPE "ProductCollection" AS ENUM ('MATCHA', 'TOOLS');

CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "collection" "ProductCollection" NOT NULL,
    "name" TEXT NOT NULL,
    "shop_display_name" TEXT,
    "kit_curated_title" TEXT,
    "home_origin" TEXT,
    "shop_origin" TEXT,
    "kit_curated_origin" TEXT,
    "home_price_label" TEXT,
    "shop_price_label" TEXT,
    "kit_curated_price_label" TEXT,
    "badge_label" TEXT,
    "sold_out" BOOLEAN NOT NULL DEFAULT false,
    "image_path" TEXT NOT NULL,
    "background_color" TEXT,
    "accent_color" TEXT,
    "kit_item_description" TEXT,
    "kit_option_label" TEXT,
    "kit_option_price" INTEGER,
    "featured_on_home" BOOLEAN NOT NULL DEFAULT false,
    "featured_in_kit" BOOLEAN NOT NULL DEFAULT false,
    "included_in_kit" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
