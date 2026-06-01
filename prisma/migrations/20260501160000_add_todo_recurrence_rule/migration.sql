ALTER TABLE "TrackerItem"
ADD COLUMN "recurrenceRule" TEXT;

ALTER TABLE "TrackerEntry"
ADD COLUMN "recurrenceRule" TEXT;
