ALTER TABLE "TrackerItem"
ADD COLUMN "dueAt" TIMESTAMP(3);

CREATE INDEX "TrackerItem_dueAt_idx" ON "TrackerItem"("dueAt");
