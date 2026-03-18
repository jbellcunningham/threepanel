-- AlterTable
ALTER TABLE "TrackerEntry" ADD COLUMN     "data" JSONB;

-- AlterTable
ALTER TABLE "TrackerItem" ADD COLUMN     "schema" JSONB;
