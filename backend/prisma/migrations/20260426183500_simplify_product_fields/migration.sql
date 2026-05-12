CREATE TYPE "CurrencyCode" AS ENUM ('USD', 'THB');

ALTER TABLE "products"
ADD COLUMN "display_name" TEXT,
ADD COLUMN "origin_label" TEXT,
ADD COLUMN "price_amount" INTEGER,
ADD COLUMN "price_currency" "CurrencyCode";

UPDATE "products"
SET
  "display_name" = COALESCE("shop_display_name", "kit_curated_title", "name"),
  "origin_label" = COALESCE("home_origin", "shop_origin", "kit_curated_origin"),
  "price_amount" = CASE
    WHEN "slug" = 'rockys' THEN 32
    WHEN "slug" = 'anya' THEN 48
    WHEN "slug" = 'rockys-dreamin' THEN 48
    WHEN "slug" = 'mellow' THEN 58
    WHEN "slug" = 'rockys-single-cultivar' THEN 78
    WHEN "slug" = 'matcha-whisk-holder' THEN 900
    WHEN "slug" = 'latte-cup' THEN 800
    WHEN "slug" = 'matcha-whisk' THEN 1700
    WHEN "slug" = 'bamboo-whisk' THEN 880
    WHEN "slug" = 'matcha-strainer' THEN 880
    ELSE 0
  END,
  "price_currency" = CASE
    WHEN "collection" = 'MATCHA' THEN 'USD'::"CurrencyCode"
    ELSE 'THB'::"CurrencyCode"
  END;

ALTER TABLE "products"
ALTER COLUMN "display_name" SET NOT NULL,
ALTER COLUMN "price_amount" SET NOT NULL,
ALTER COLUMN "price_currency" SET NOT NULL;

ALTER TABLE "products"
DROP COLUMN "shop_display_name",
DROP COLUMN "kit_curated_title",
DROP COLUMN "home_origin",
DROP COLUMN "shop_origin",
DROP COLUMN "kit_curated_origin",
DROP COLUMN "home_price_label",
DROP COLUMN "shop_price_label",
DROP COLUMN "kit_curated_price_label",
DROP COLUMN "background_color",
DROP COLUMN "accent_color",
DROP COLUMN "kit_option_label",
DROP COLUMN "kit_option_price";
