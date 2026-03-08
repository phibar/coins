-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('coin', 'ersttagsbrief');

-- AlterTable
ALTER TABLE "coins" ADD COLUMN     "count" INTEGER DEFAULT 1,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "item_type" "ItemType" NOT NULL DEFAULT 'coin',
ALTER COLUMN "country" DROP NOT NULL,
ALTER COLUMN "denomination" DROP NOT NULL,
ALTER COLUMN "year" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "coins_item_type_idx" ON "coins"("item_type");
