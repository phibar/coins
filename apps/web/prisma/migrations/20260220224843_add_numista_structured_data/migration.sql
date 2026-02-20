-- DropIndex
DROP INDEX "coins_numista_type_id_key";

-- AlterTable
ALTER TABLE "coins" ADD COLUMN     "commemorated_topic" TEXT,
ADD COLUMN     "comments" TEXT,
ADD COLUMN     "demonetization_date" TEXT,
ADD COLUMN     "estimated_currency" TEXT DEFAULT 'EUR',
ADD COLUMN     "estimated_value" DOUBLE PRECISION,
ADD COLUMN     "is_demonetized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "numista_issues" JSONB,
ADD COLUMN     "numista_mints" JSONB,
ADD COLUMN     "numista_obverse" JSONB,
ADD COLUMN     "numista_obverse_thumbnail" TEXT,
ADD COLUMN     "numista_prices" JSONB,
ADD COLUMN     "numista_references" JSONB,
ADD COLUMN     "numista_related_types" JSONB,
ADD COLUMN     "numista_reverse" JSONB,
ADD COLUMN     "numista_reverse_thumbnail" TEXT,
ADD COLUMN     "numista_ruler" JSONB,
ADD COLUMN     "orientation" TEXT,
ADD COLUMN     "series" TEXT,
ADD COLUMN     "shape" TEXT,
ADD COLUMN     "technique" TEXT;

-- CreateIndex
CREATE INDEX "coins_estimated_value_idx" ON "coins"("estimated_value");
