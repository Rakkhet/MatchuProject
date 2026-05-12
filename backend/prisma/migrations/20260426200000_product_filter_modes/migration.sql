-- AlterTable
ALTER TABLE "products" ADD COLUMN     "cultivar_key" TEXT,
ADD COLUMN     "offering_key" TEXT,
ADD COLUMN     "origin_key" TEXT,
ADD COLUMN     "size_key" TEXT,
ADD COLUMN     "subscription_enabled" BOOLEAN NOT NULL DEFAULT false;
