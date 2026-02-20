-- CreateEnum
CREATE TYPE "CoinCondition" AS ENUM ('s', 'ss', 'vz', 'st', 'stgl', 'PP');

-- CreateEnum
CREATE TYPE "ImageType" AS ENUM ('obverse', 'reverse', 'edge', 'other');

-- CreateTable
CREATE TABLE "coins" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "country" TEXT NOT NULL,
    "denomination" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "mint_mark" TEXT,
    "material" TEXT,
    "fineness" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "diameter" DOUBLE PRECISION,
    "thickness" DOUBLE PRECISION,
    "condition" "CoinCondition",
    "is_proof" BOOLEAN NOT NULL DEFAULT false,
    "is_first_day" BOOLEAN NOT NULL DEFAULT false,
    "has_case" BOOLEAN NOT NULL DEFAULT false,
    "has_certificate" BOOLEAN NOT NULL DEFAULT false,
    "edge_type" TEXT,
    "mintage" INTEGER,
    "storage_location" TEXT,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "numista_type_id" INTEGER,
    "numista_title" TEXT,
    "numista_url" TEXT,
    "numista_last_sync" TIMESTAMP(3),
    "session_id" TEXT,

    CONSTRAINT "coins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coin_images" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "ImageType" NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail_url" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "s3_key_thumb" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "coin_id" TEXT NOT NULL,

    CONSTRAINT "coin_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capture_sessions" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "country" TEXT,
    "denomination" TEXT,
    "year" INTEGER,
    "mint_mark" TEXT,
    "material" TEXT,
    "fineness" DOUBLE PRECISION,
    "condition" "CoinCondition",
    "storage_location" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "capture_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coins_numista_type_id_key" ON "coins"("numista_type_id");

-- CreateIndex
CREATE INDEX "coins_country_idx" ON "coins"("country");

-- CreateIndex
CREATE INDEX "coins_year_idx" ON "coins"("year");

-- CreateIndex
CREATE INDEX "coins_country_denomination_year_idx" ON "coins"("country", "denomination", "year");

-- CreateIndex
CREATE INDEX "coin_images_coin_id_idx" ON "coin_images"("coin_id");

-- AddForeignKey
ALTER TABLE "coins" ADD CONSTRAINT "coins_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "capture_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_images" ADD CONSTRAINT "coin_images_coin_id_fkey" FOREIGN KEY ("coin_id") REFERENCES "coins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
